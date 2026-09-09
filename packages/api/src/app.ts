import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { JamotRepository } from "./repository.js";
import { sessionOptions } from "./auth.js";
import type { FastifySessionOptions } from "@fastify/session";
import { createSecretStore } from "@jamot/core/secrets/secret-store";
import { createCredentialResolver } from "@jamot/core/secrets/credential-resolution";
import { createLLMProvider } from "@jamot/core/llm";
import type { LLMProvider } from "@jamot/core/llm";
import { healthRoutes } from "./routes/health.js";
import { actorsRoutes } from "./routes/actors.js";
import { peopleRoutes } from "./routes/people.js";
import { organizationsRoutes } from "./routes/organizations.js";
import { dreamRoutes } from "./routes/dream.js";
import { spacesRoutes } from "./routes/spaces.js";
import { rolesRoutes } from "./routes/roles.js";
import { tasksRoutes } from "./routes/tasks.js";
import { authRoutes } from "./routes/auth.js";
import connectorsRoutes from "./routes/connectors.js";
import composioRoutes from "./routes/composio.js";
import { createComposioService } from "@jamot/core/composio";
import type { ComposioService } from "@jamot/core/composio";
import capabilitiesRoutes from "./routes/capabilities.js";
import skillsRoutes from "./routes/skills.js";
import vaultRoutes from "./routes/vault.js";
import modelsRoutes from "./routes/models.js";
import assignmentsRoutes from "./routes/assignments.js";
import agentsRoutes from "./routes/agents.js";
import spaceSettingsRoutes from "./routes/space-settings.js";
import channelsRoutes from "./routes/channels.js";
import taskListsRoutes from "./routes/task-lists.js";
import memoryRoutes from "./routes/memory.js";
import knowledgeRoutes from "./routes/knowledge.js";
import appsRoutes from "./routes/apps.js";
import resolveAppsRoutes from "./routes/resolver.js";
import reputationRoutes from "./routes/reputation.js";
import treasuryRoutes from "./routes/treasury.js";
import oauthRoutes from "./routes/oauth.js";
import { googleConnectorRoutes } from "./routes/google-connect.js";
import { eventsRoutes } from "./routes/events.js";
import waRoutes from "./routes/wa.js";
import notificationsRoutes from "./routes/notifications.js";
import { clientLogRoutes } from "./routes/client-log.js";
import type { MemoryProvider } from "@jamot/core/memory";
import type { KnowledgeStore } from "@jamot/core/knowledge";
import { createInMemoryMemoryProvider } from "@jamot/core/memory";
import { createInMemoryKnowledgeStore } from "@jamot/core/knowledge";
import { createAppRegistry } from "@jamot/core/apps";
import type { AppRegistry } from "@jamot/core/apps";
import { createInMemoryReputationService } from "@jamot/core/reputation";
import type { ReputationService } from "@jamot/core/reputation";
import { createInMemoryTreasuryService } from "@jamot/core/treasury";
import type { TreasuryService } from "@jamot/core/treasury";
import { createCommerceService } from "@jamot/core/commerce";
import type { CommerceService } from "@jamot/core/commerce";
import { createPaymentService } from "@jamot/core/payments";
import type { PaymentService } from "@jamot/core/payments";
import { createLedgerPaymentProvider } from "@jamot/core/payments";
import suppliersRoutes from "./routes/suppliers.js";
import catalogRoutes from "./routes/catalog.js";
import procurementRoutes from "./routes/procurement.js";
import paymentsRoutes from "./routes/payments.js";
import outreachRoutes from "./routes/outreach.js";
import leadsRoutes from "./routes/leads.js";
import { createLeadGenerationService, createLeadProviderRegistry } from "@jamot/core/leads";
import type { LeadGenerationService } from "@jamot/core/leads";

export interface SecretStoreLike {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export interface BuildAppOptions {
  repository: JamotRepository;
  secret: string;
  logger?: boolean;
  sessionStore?: FastifySessionOptions["store"];
  secretStore?: SecretStoreLike;
  llm?: LLMProvider;
  memoryProvider?: MemoryProvider;
  knowledgeStore?: KnowledgeStore;
  apps?: AppRegistry;
  reputation?: ReputationService;
  treasury?: TreasuryService;
  commerce?: CommerceService;
  payments?: PaymentService;
  whatsAppManager?: import("@jamot/core/channels").WhatsAppManager;
  composioService?: ComposioService;
  leads?: LeadGenerationService;
}

const deriveKey = (secret: string): string =>
  createHash("sha256").update(secret).digest("base64");

export async function buildApp(opts: BuildAppOptions) {
  const app = Fastify({ logger: opts.logger ?? false });

  const secretStore = opts.secretStore ?? createSecretStore({ encryptionKey: deriveKey(opts.secret) });
  const credentialResolver = createCredentialResolver({ repo: opts.repository, store: secretStore });
  const llm = opts.llm ?? createLLMProvider("mock");
  const memoryProvider = opts.memoryProvider ?? createInMemoryMemoryProvider();
  const knowledgeStore = opts.knowledgeStore ?? createInMemoryKnowledgeStore();
  const apps = opts.apps ?? createAppRegistry();
  const reputation = opts.reputation ?? createInMemoryReputationService();
  const treasury = opts.treasury ?? createInMemoryTreasuryService();
  const ledgerProvider = createLedgerPaymentProvider({
    settle: (input) =>
      treasury.recordPayment({
        buyerOrganizationId: input.buyerOrganizationId,
        sellerOrganizationId: input.sellerOrganizationId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        metadata: input.metadata,
      }),
  });
  const payments: PaymentService = opts.payments ?? createPaymentService({
    repo: opts.repository,
    providers: { ledger: ledgerProvider },
    defaultProvider: "ledger",
  });
  const commerce: CommerceService = opts.commerce ?? createCommerceService({
    repo: opts.repository,
    createPaymentIntentForOrder: (po) => payments.intentForPurchaseOrder(po),
    approvalThreshold: 1000,
  });

  app.decorateRequest("actor", null);
  app.decorateRequest("person", null);

  await app.register(cookie);
  await app.register(session, sessionOptions(opts.secret, opts.sessionStore));
  await app.register(helmet, { global: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });

  const uploadsRoot = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Tolerate `Content-Type: application/json` requests with an empty body
  // (body-less POSTs like /wa/accounts/:id/reset) instead of 400ing.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      if (body === "" || body == null) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.addHook("onRequest", async (request) => {
    const actorId = request.session?.actorId;
    if (actorId) {
      request.actor = await opts.repository.getActor(actorId);
      const personId = request.session?.personId;
      if (personId) request.person = await opts.repository.getPerson(personId);
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    if (!mutating || !request.url.startsWith("/api/")) return;
    request.log.info(
      { actorId: request.session?.actorId ?? null, method: request.method, url: request.url, status: reply.statusCode },
      "audit",
    );
  });

  const routeOpts = {
    repository: opts.repository,
    secretStore,
    credentialResolver: credentialResolver.resolveCredential,
  };

  const composioService =
    opts.composioService ??
    createComposioService({
      repo: opts.repository,
      store: secretStore,
      baseUrl: process.env.COMPOSIO_BASE_URL,
    });

  const leads =
    opts.leads ??
    createLeadGenerationService(
      opts.repository,
      createLeadProviderRegistry({
        repo: opts.repository,
        secretStore,
        composio: composioService,
        env: process.env,
      }),
      {
        repo: opts.repository,
        secretStore,
        composio: composioService,
        env: process.env,
      },
    );

  await app.register(healthRoutes);
  await app.register(actorsRoutes(opts.repository), { prefix: "/api" });
  await app.register(peopleRoutes(opts.repository), { prefix: "/api" });
  await app.register(organizationsRoutes(opts.repository, { memoryProvider, apps }), { prefix: "/api" });
  await app.register(dreamRoutes(opts.repository, { memoryProvider }), { prefix: "/api" });
  await app.register(spacesRoutes(opts.repository), { prefix: "/api" });
  await app.register(rolesRoutes(opts.repository), { prefix: "/api" });
  await app.register(tasksRoutes(opts.repository), { prefix: "/api" });
  await app.register(authRoutes(opts.repository), { prefix: "/api" });
  await app.register(connectorsRoutes, { prefix: "/api", ...routeOpts });
  await app.register(composioRoutes, {
    prefix: "/api",
    repository: opts.repository,
    composioService,
    secretStore,
  });
  await app.register(capabilitiesRoutes, { prefix: "/api", ...routeOpts });
  await app.register(skillsRoutes, { prefix: "/api", ...routeOpts });
  await app.register(vaultRoutes, { prefix: "/api", ...routeOpts });
  await app.register(modelsRoutes, { prefix: "/api", ...routeOpts });
  await app.register(assignmentsRoutes, {
    prefix: "/api",
    repository: opts.repository,
    llm,
    secretStore,
  });
  await app.register(agentsRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(spaceSettingsRoutes, {
    prefix: "/api",
    repository: opts.repository,
  });
  await app.register(channelsRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(taskListsRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(memoryRoutes, { prefix: "/api", memoryProvider });
  await app.register(knowledgeRoutes, { prefix: "/api", knowledgeStore });
  await app.register(appsRoutes, { prefix: "/api", apps });
  await app.register(resolveAppsRoutes, { prefix: "/api", repo: opts.repository, apps });
  await app.register(reputationRoutes, { prefix: "/api", reputation });
  await app.register(treasuryRoutes, { prefix: "/api", treasury });
  await app.register(notificationsRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(oauthRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(googleConnectorRoutes(opts.repository, secretStore), { prefix: "/api" });
  await app.register(eventsRoutes(opts.repository), { prefix: "/api" });
  await app.register(clientLogRoutes, { prefix: "/api" });
  await app.register(waRoutes, { prefix: "/api", repository: opts.repository, whatsAppManager: opts.whatsAppManager });
  await app.register(suppliersRoutes, { prefix: "/api", commerce });
  await app.register(catalogRoutes, { prefix: "/api", commerce });
  await app.register(procurementRoutes, { prefix: "/api", commerce });
  await app.register(paymentsRoutes, { prefix: "/api", payments });
  await app.register(outreachRoutes, { prefix: "/api", repository: opts.repository });
  await app.register(leadsRoutes, { prefix: "/api", repository: opts.repository, leads });

  return app;
}
