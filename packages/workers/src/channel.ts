import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  createChannelRegistry,
  createChannelService,
  createMatrixAdapter,
  createTelegramAdapter,
  createWhatsAppControlServer,
  createWhatsAppManager,
  resolveReplyAgent,
  draftAgentReply,
  recordInteractionMemory,
} from "@jamot/core/channels";
import type { InboundMessage } from "@jamot/core/channels";
import { createDb, createEventBus } from "@jamot/core";
import { runMigrations } from "@jamot/core/migrate";
import { createMemoryRepository } from "@jamot/core/repository/memory";
import { createPgRepository } from "@jamot/core/repository/pg";
import { createChannelPersonProvisioner } from "@jamot/core/ingest";
import {
  createPostgresMemoryProvider,
  createGraphitiMemoryMirror,
  createDualWriteMemoryProvider,
  type MemoryProvider,
} from "@jamot/core/memory";
import { createMcpClient } from "@jamot/core/mcp";
import { createLLMProvider, resolveEnabledModel, type LLMProvider } from "@jamot/core/llm";
import { createSecretStore } from "@jamot/core/secrets/secret-store";

export async function startChannelWorker(): Promise<void> {
  const registry = createChannelRegistry();

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) await runMigrations(databaseUrl);
  const db = databaseUrl ? createDb(databaseUrl) : undefined;
  const repo = db ? createPgRepository(db) : createMemoryRepository();
  const eventBus = createEventBus(db);

  const service = createChannelService({
    repo,
    eventBus,
    registry,
  });

  // Every inbound channel message resolves to ONE canonical Person with the
  // channel identity attached (identity resolution lives in core/ingest).
  const provisioner = createChannelPersonProvisioner({
    repo,
    spaceResolver: async (channelId) => {
      const account = await repo.getChannelAccount(channelId);
      return account?.spaceId;
    },
  });

  // Same Postgres-primary + optional Graphiti-mirror wiring as the API
  // process (packages/api/src/index.ts) — every channel this worker handles
  // (WhatsApp, Telegram, Matrix) should write to the same person memory.
  let memoryProvider: MemoryProvider | undefined;
  if (db) {
    memoryProvider = createPostgresMemoryProvider(db);
    if (process.env.GRAPHITI_ENABLED === "true" && process.env.GRAPHITI_MCP_URL) {
      memoryProvider = createDualWriteMemoryProvider(
        memoryProvider,
        createGraphitiMemoryMirror({ client: createMcpClient(process.env.GRAPHITI_MCP_URL) }),
      );
    }
  }

  // Same key derivation as the API process's secret store — must match so
  // that model API keys encrypted there can be decrypted here.
  const sessionSecret = process.env.SESSION_SECRET ?? "jamot-dev-secret-change-me";
  const replySecretStore = createSecretStore({
    encryptionKey: createHash("sha256").update(sessionSecret).digest("base64"),
  });
  const fallbackLlm = process.env.OPENAI_API_KEY ? createLLMProvider("openai") : undefined;
  const resolveReplyLlm = async (spaceId: string, agentId: string): Promise<LLMProvider | null> => {
    const [org, agent] = await Promise.all([
      repo.getOrganizationBySpaceId(spaceId),
      repo.getAgent(agentId),
    ]);
    const cfg = await resolveEnabledModel({
      repo,
      store: replySecretStore,
      organizationId: org?.id ?? null,
      actorId: agent?.ownerId ?? undefined,
      prefer: agent?.model ?? undefined,
    });
    if (!cfg) return fallbackLlm ?? null;
    try {
      return createLLMProvider(cfg.kind, { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model });
    } catch {
      return fallbackLlm ?? null;
    }
  };

  const onMessage = (msg: InboundMessage) => {
    console.log(`[channel:${msg.kind}] ${msg.sender}: ${msg.text}`);
    void provisioner
      .handleInbound(msg)
      .then(async (result) => {
        if (!result.person) return;

        if (msg.text) {
          void recordInteractionMemory(
            memoryProvider,
            {
              personId: result.person.id,
              channelKind: msg.kind,
              direction: "inbound",
              text: msg.text,
              timestamp: msg.timestamp,
            },
            fallbackLlm ? { repo, llm: fallbackLlm } : undefined,
          );
        }

        if (!msg.text) return;
        const account = await repo.getChannelAccount(msg.channelId);
        if (!account) return;
        const agentId = await resolveReplyAgent(repo, {
          personId: result.person.id,
          spaceId: account.spaceId,
          isNewPerson: result.created,
        });
        if (!agentId) return;
        const replyLlm = await resolveReplyLlm(account.spaceId, agentId);
        if (!replyLlm) {
          console.warn(
            `[channel] no model configured for agent ${agentId} in space ${account.spaceId} — skipping auto-reply`,
          );
          return;
        }
        const reply = await draftAgentReply(
          { repo, llm: replyLlm, memory: memoryProvider },
          { agentId, personId: result.person.id, messageText: msg.text },
        );
        if (!reply) return;
        if (msg.kind === "whatsapp") {
          const waAdapter = manager?.get(msg.channelId);
          if (!waAdapter) return;
          await waAdapter.send(msg.sender, reply);
        } else {
          const adapter = registry.get(msg.channelId);
          if (!adapter) return;
          await adapter.send(msg.sender, reply);
        }
        void recordInteractionMemory(memoryProvider, {
          personId: result.person.id,
          channelKind: msg.kind,
          direction: "outbound",
          text: reply,
          timestamp: new Date().toISOString(),
        });
      })
      .catch((err) => console.error("[channel] person provisioning failed", err));
    void service.onInbound(msg);
  };

  const whatsappSessionDirRaw = process.env.WHATSAPP_SESSION_DIR;
  const whatsappSessionDir =
    whatsappSessionDirRaw && whatsappSessionDirRaw.trim()
      ? whatsappSessionDirRaw
      : undefined;
  const whatsappProxyUrl = process.env.WHATSAPP_PROXY_URL;
  const matrixHomeserver = process.env.MATRIX_HOMESERVER_URL;
  const matrixUser = process.env.MATRIX_BOT_USER;
  const matrixToken =
    process.env.MATRIX_ACCESS_TOKEN ?? process.env.MATRIX_BOT_PASSWORD;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramApiUrl = process.env.TELEGRAM_API_URL;

  const promises: Promise<void>[] = [];
  let manager: ReturnType<typeof createWhatsAppManager> | undefined;

  if (whatsappSessionDir) {
    manager = createWhatsAppManager({
      sessionBaseDir: whatsappSessionDir,
      onMessage,
      proxyUrl: whatsappProxyUrl,
    });

    const controlPort = Number(
      process.env.PORT ?? process.env.WA_CONTROL_PORT ?? 3001,
    );
    console.log(
      `[channel] whatsapp control server: internal=${process.env.RENDER_INTERNAL_HOSTNAME ?? "n/a"} port=${controlPort}`,
    );
    const server = createWhatsAppControlServer(manager, { port: controlPort });
    promises.push(server.start());

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[channel] ${signal} received — closing whatsapp sockets cleanly`);
      void (async () => {
        try {
          await manager?.close();
        } catch (err) {
          console.error("[channel] whatsapp close failed", err);
        }
        try {
          await server.close();
        } catch (err) {
          console.error("[channel] control server close failed", err);
        }
        process.exit(0);
      })();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  if (matrixHomeserver && matrixUser && matrixToken) {
    const adapter = createMatrixAdapter({
      homeserver: matrixHomeserver,
      userId: matrixUser,
      accessToken: matrixToken,
    });
    adapter.onMessage(onMessage);
    registry.register(adapter);
    promises.push(adapter.connect());
  }

  if (telegramToken) {
    const adapter = createTelegramAdapter({
      token: telegramToken,
      apiUrl: telegramApiUrl,
    });
    adapter.onMessage(onMessage);
    registry.register(adapter);
    promises.push(adapter.connect());
  }

  const connectChannelAccount = async (
    accountId: string,
    protocol: "telegram" | "matrix",
    connect: () => Promise<unknown>,
  ): Promise<void> => {
    try {
      await repo.updateChannelAccount(accountId, { status: "connecting" });
      await connect();
      await repo.updateChannelAccount(accountId, { status: "connected" });
    } catch (err) {
      console.error(`[channel] ${protocol} account ${accountId} failed to connect`, err);
      await repo.updateChannelAccount(accountId, { status: "error" }).catch(() => undefined);
    }
  };

  try {
    const channelAccounts = await repo.listAllChannelAccounts();
    for (const account of channelAccounts) {
      if (!account.token) continue;
      if (account.protocol === "telegram") {
        const adapter = createTelegramAdapter({ id: account.id, token: account.token, apiUrl: telegramApiUrl });
        adapter.onMessage((msg) => onMessage({ ...msg, spaceId: account.spaceId }));
        registry.register(adapter);
        promises.push(connectChannelAccount(account.id, "telegram", () => adapter.connect()));
      } else if (account.protocol === "matrix" && account.identifier && matrixHomeserver) {
        const adapter = createMatrixAdapter({
          id: account.id,
          homeserver: matrixHomeserver,
          userId: account.identifier,
          accessToken: account.token,
        });
        adapter.onMessage((msg) => onMessage({ ...msg, spaceId: account.spaceId }));
        registry.register(adapter);
        promises.push(connectChannelAccount(account.id, "matrix", () => adapter.connect()));
      }
    }
  } catch (err) {
    console.error("[channel] failed to load channel accounts", err);
  }

  if (promises.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(promises).then(() => undefined);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  void startChannelWorker();
}