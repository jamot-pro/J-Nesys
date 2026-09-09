import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";
import { createPgRepositoryFromDb } from "./pgRepository.js";
import { superAdminEmails } from "./auth.js";
import { createDb } from "@jamot/core";
import { runMigrations } from "@jamot/core/migrate";
import type { Db } from "@jamot/core";
import { createEventBus } from "@jamot/core";
import {
  createWhatsAppManager,
  createWhatsAppControlServer,
  type InboundMessage,
} from "@jamot/core/channels";
import { createWhatsAppPersonProvisioner } from "@jamot/core/ingest";
import { createPostgresMemoryProvider } from "@jamot/core/memory";
import { createGraphitiMemoryMirror } from "@jamot/core/memory";
import { createDualWriteMemoryProvider } from "@jamot/core/memory";
import { createMcpClient } from "@jamot/core/mcp";
import { createPostgresKnowledgeStore } from "@jamot/core/knowledge";
import { createPostgresReputationService } from "@jamot/core/reputation";
import { createPostgresTreasuryService } from "@jamot/core/treasury";
import { createLLMProvider } from "@jamot/core/llm";
import type { MemoryProvider } from "@jamot/core/memory";
import type { KnowledgeStore } from "@jamot/core/knowledge";
import type { ReputationService } from "@jamot/core/reputation";
import type { TreasuryService } from "@jamot/core/treasury";
import type { LLMProvider } from "@jamot/core/llm";
import { createSessionStore } from "./session-store.js";
import { createHash } from "node:crypto";
import { createSecretStore } from "@jamot/core/secrets/secret-store";
import { createGoogleSyncService } from "@jamot/core/google";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";
const secret = process.env.SESSION_SECRET ?? "jamot-dev-secret-change-me";

let repository: ReturnType<typeof createMemoryRepository> | ReturnType<typeof createPgRepositoryFromDb>;
let db: Db | undefined;
let memoryProvider: MemoryProvider | undefined;
let knowledgeStore: KnowledgeStore | undefined;
let reputation: ReputationService | undefined;
let treasury: TreasuryService | undefined;
let llm: LLMProvider | undefined;

if (process.env.DATABASE_URL) {
  await runMigrations(process.env.DATABASE_URL);
  db = createDb(process.env.DATABASE_URL);
  repository = createPgRepositoryFromDb(db);
  memoryProvider = createPostgresMemoryProvider(db);
  knowledgeStore = createPostgresKnowledgeStore(db);
  reputation = createPostgresReputationService(db);
  treasury = createPostgresTreasuryService(db);

  // Temporal knowledge graph projection: Postgres stays the source of truth for
  // reads; Graphiti (self-hosted MCP server) receives a parallel write that is
  // soft-failing — a mirror error never breaks the request.
  if (process.env.GRAPHITI_ENABLED === "true") {
    const graphitiUrl = process.env.GRAPHITI_MCP_URL;
    if (graphitiUrl) {
      const mirror = createGraphitiMemoryMirror({
        client: createMcpClient(graphitiUrl),
      });
      memoryProvider = createDualWriteMemoryProvider(memoryProvider, mirror);
      console.log(`[graphiti] temporal-graph mirror enabled (${graphitiUrl})`);
    } else {
      console.warn(
        "[graphiti] GRAPHITI_ENABLED=true but GRAPHITI_MCP_URL unset; skipping",
      );
    }
  }
} else {
  repository = createMemoryRepository();
}

if (process.env.OPENAI_API_KEY) {
  llm = createLLMProvider("openai");
}

try {
  for (const email of superAdminEmails()) {
    const user = await repository.findUserByEmail(email);
    if (user) await repository.setSuperAdmin(user.person.id, true);
  }
} catch (err) {
  console.warn("super admin reconciliation failed", err);
}

// WhatsApp channel manager — runs Baileys in-process (leadpilot-style) so it
// connects from the API service's own egress rather than a separate pserv.
let whatsAppManager: ReturnType<typeof createWhatsAppManager> | undefined;
const whatsappSessionDir = process.env.WHATSAPP_SESSION_DIR;
if (whatsappSessionDir) {
  const eventBus = createEventBus(db);
  const onMessage = (msg: InboundMessage) => {
    console.log(`[channel:whatsapp] ${msg.sender}: ${msg.text}`);
    void eventBus
      .publish({
        type: "message.received",
        idempotencyKey: `${msg.kind}:${msg.sender}:${msg.timestamp}`,
        payload: {
          channelId: msg.channelId,
          kind: msg.kind,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          room: msg.room,
          raw: msg.raw,
        },
      })
      .catch((err) => {
        console.error("[channel] publish failed", err);
      });
  };
  whatsAppManager = createWhatsAppManager({
    sessionBaseDir: whatsappSessionDir,
    onMessage,
    proxyUrl: process.env.WHATSAPP_PROXY_URL,
  });

  const provisioner = createWhatsAppPersonProvisioner({
    repo: repository,
    spaceResolver: async (channelId) => {
      const account = await repository.getWaAccount(channelId);
      return account?.spaceId;
    },
  });
  const provisioned = new Set<string>();
  eventBus.subscribe("message.received", async (event) => {
    const payload = event.payload as {
      channelId?: string;
      kind?: string;
      sender?: string;
      timestamp?: string;
    };
    if (!payload?.channelId || !payload?.sender || !payload?.timestamp) return;
    const dedupeKey = `${payload.kind}:${payload.channelId}:${payload.sender}:${payload.timestamp}`;
    if (provisioned.has(dedupeKey)) return;
    provisioned.add(dedupeKey);
    try {
      const result = await provisioner.handleInbound({
        channelId: payload.channelId,
        kind: payload.kind as InboundMessage["kind"],
        sender: payload.sender,
        text: "",
        timestamp: payload.timestamp,
      });
      if (result.created) {
        console.log(
          `[channel] provisioned person ${result.person?.id} (${payload.sender})`,
        );
      }
    } catch (err) {
      console.error("[channel] person provisioning failed", err);
    }
  });

  const waControlPort = Number(process.env.WA_CONTROL_PORT ?? 3001);
  const controlServer = createWhatsAppControlServer(whatsAppManager, {
    port: waControlPort,
  });
  await controlServer.start();
  console.log(
    `[channel] whatsapp manager started in-process (session=${whatsappSessionDir}, controlPort=${controlServer.port})`,
  );
  process.on("exit", () => {
    void controlServer.close().catch(() => {});
  });
}

const app = await buildApp({
  repository,
  secret,
  sessionStore: await createSessionStore(),
  logger: true,
  memoryProvider,
  knowledgeStore,
  reputation,
  treasury,
  llm,
  whatsAppManager,
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received — shutting down cleanly`);
  try {
    await app.close();
  } catch (err) {
    app.log.error(err);
  }
  if (whatsAppManager) {
    try {
      await whatsAppManager.close();
    } catch (err) {
      console.error("[channel] whatsapp close failed", err);
    }
  }
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Periodic Google connector sync (People import + Gmail sender ingestion).
// Runs in-process: the API owns the vault key derivation.
if (
  repository &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
) {
  const syncStore = createSecretStore({
    encryptionKey: createHash("sha256").update(secret).digest("base64"),
  });
  const googleSync = createGoogleSyncService({
    repo: repository,
    store: syncStore,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  const syncGoogleConnectors = async () => {
    try {
      const connectors = (await repository.listConnectors()).filter(
        (c) => c.provider === "google",
      );
      for (const connector of connectors) {
        try {
          const result = await googleSync.syncConnector(connector);
          console.log(
            `[google] sync ${connector.id}: ${result.contacts} contacts, ${result.senders} senders`,
          );
        } catch (err) {
          console.error(`[google] sync failed for ${connector.id}`, err);
          await repository
            .updateConnectorStatus(connector.id, "error")
            .catch(() => undefined);
        }
      }
    } catch (err) {
      console.error("[google] connector scan failed", err);
    }
  };
  void syncGoogleConnectors();
  const timer = setInterval(() => void syncGoogleConnectors(), 15 * 60 * 1000);
  timer.unref();
}

try {
  await app.listen({ host, port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
