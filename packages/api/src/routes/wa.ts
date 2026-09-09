import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import { requireAuth, createRbac } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { JamotRepository, WaAccountRecord } from "../repository.js";
import type { WhatsAppManager } from "@jamot/core/channels";

const CreateAccountBody = z.object({
  spaceId: z.string().min(1),
  label: z.string().min(1).max(120),
});

const CreateChannelAccountBody = z.object({
  spaceId: z.string().min(1),
  protocol: z.enum(["telegram", "matrix"]),
  label: z.string().min(1).max(120),
  identifier: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
});

const SendBody = z.object({
  jid: z.string().min(1),
  text: z.string().min(1),
});

const ReadBody = z.object({
  jid: z.string().min(1),
});

const MediaBody = z.object({
  jid: z.string().min(1),
  type: z.enum(["image", "video", "audio"]),
  data: z.string().min(1),
  caption: z.string().optional(),
  filename: z.string().optional(),
  mimetype: z.string().optional(),
});

const ImportBody = z.object({
  files: z.record(z.string(), z.string()),
});

export interface WaRouteOptions {
  repository: JamotRepository;
  workerUrl?: string;
  whatsAppManager?: WhatsAppManager;
}

type FailReply = Parameters<typeof fail>[0];

export default async function waRoutes(
  app: FastifyInstance,
  opts: WaRouteOptions,
): Promise<void> {
  const { repository } = opts;
  const manager = opts.whatsAppManager;
  const rbac = createRbac(repository);

  const loadAccount = async (
    id: string,
    reply: FailReply,
  ): Promise<WaAccountRecord | undefined> => {
    const account = await repository.getWaAccount(id);
    if (!account) {
      fail(reply, 404, "wa account not found");
      return undefined;
    }
    return account;
  };

  const resolveSpaceFromQuery = rbac.requireSpaceAccess("spaceId");

  const fetchStateBestEffort = async (id: string) => {
    if (!manager) return undefined;
    try {
      const adapter = manager.get(id) ?? manager.ensure(id);
      return adapter.getState() as {
        connection?: string;
        qr?: string;
        phone?: string;
      };
    } catch {
      return undefined;
    }
  };

  app.post(
    "/wa/accounts",
    { preHandler: [requireAuth, resolveSpaceFromQuery] },
    async (request, reply) => {
      const body = parse(CreateAccountBody, request.body, reply);
      if (!body) return;
      const account = await repository.createWaAccount(
        body.spaceId,
        body.label,
      );
      reply.code(201);
      return account;
    },
  );

  app.get(
    "/wa/accounts",
    { preHandler: [requireAuth, resolveSpaceFromQuery] },
    async (request, reply) => {
      const query = request.query as { spaceId?: string };
      if (!query.spaceId) return fail(reply, 400, "spaceId is required");
      const accounts = await repository.listWaAccounts(query.spaceId);
      const withState = await Promise.all(
        accounts.map(async (account) => {
          const state = await fetchStateBestEffort(account.id);
          if (!state) return { ...account, connection: null, qr: null };
          return { ...account, ...state };
        }),
      );
      return { items: withState };
    },
  );

  app.get(
    "/wa/accounts/:id/state",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      return adapter.getState();
    },
  );

  app.post(
    "/wa/accounts/:id/reset",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      await repository.updateWaAccount(id, { status: "pairing" });
      const adapter = manager.get(id) ?? manager.ensure(id);
      await adapter.resetSession();
      return { ok: true };
    },
  );

  app.post(
    "/wa/accounts/:id/logout",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      await repository.updateWaAccount(id, {
        status: "offline",
        phone: null,
      });
      if (manager) {
        const adapter = manager.get(id);
        if (adapter) await manager.remove(id);
      }
      return { ok: true };
    },
  );

  app.delete(
    "/wa/accounts/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      if (manager) {
        const adapter = manager.get(id);
        if (adapter) await manager.remove(id).catch(() => {});
      }
      await repository.deleteWaAccount(id);
      return { ok: true };
    },
  );

  app.post(
    "/wa/accounts/:id/session",
    { preHandler: requireAuth, bodyLimit: 64 * 1024 * 1024 },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const body = parse(ImportBody, request.body, reply);
      if (!body) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      await adapter.importSession(body.files);
      return { ok: true };
    },
  );

  app.post(
    "/wa/accounts/:id/send",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const body = parse(SendBody, request.body, reply);
      if (!body) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      await adapter.sendText(body.jid, body.text);
      return { ok: true };
    },
  );

  app.post(
    "/wa/accounts/:id/media",
    { preHandler: requireAuth, bodyLimit: 15728640 },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const body = parse(MediaBody, request.body, reply);
      if (!body) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      await adapter.sendMedia(body);
      return { ok: true };
    },
  );

  app.post(
    "/wa/accounts/:id/read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const body = parse(ReadBody, request.body, reply);
      if (!body) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      await adapter.markRead(body.jid);
      return { ok: true };
    },
  );

  app.get(
    "/wa/accounts/:id/chats",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      return { items: adapter.listChats() };
    },
  );

  app.get(
    "/wa/accounts/:id/contacts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const query = request.query as { q?: string };
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      return { items: adapter.listContacts(query.q) };
    },
  );

  app.get(
    "/wa/accounts/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const query = request.query as { jid?: string; before?: string; limit?: string };
      if (!query.jid) return fail(reply, 400, "jid is required");
      const opts: { before?: number; limit?: number } = {};
      if (query.before) opts.before = Number(query.before);
      if (query.limit) opts.limit = Number(query.limit);
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      return { items: adapter.getMessages(query.jid, opts) };
    },
  );

  app.get(
    "/wa/accounts/:id/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await loadAccount(id, reply);
      if (!account) return;
      const query = request.query as { q?: string };
      if (!manager) return fail(reply, 503, "whatsapp manager not configured");
      const adapter = manager.get(id) ?? manager.ensure(id);
      return { items: adapter.searchMessages(query.q ?? "") };
    },
  );

  app.get("/wa/net-meta", { preHandler: requireAuth }, async (_req, reply) => {
    return { internalHostname: process.env.RENDER_INTERNAL_HOSTNAME ?? null };
  });

  app.post(
    "/wa/channels",
    { preHandler: [requireAuth, resolveSpaceFromQuery] },
    async (request, reply) => {
      const body = parse(CreateChannelAccountBody, request.body, reply);
      if (!body) return;
      const account = await repository.createChannelAccount({
        spaceId: body.spaceId,
        protocol: body.protocol,
        label: body.label,
        identifier: body.identifier,
        token: body.token,
      });
      reply.code(201);
      return account;
    },
  );

  app.get(
    "/wa/channels",
    { preHandler: [requireAuth, resolveSpaceFromQuery] },
    async (request, reply) => {
      const query = request.query as { spaceId?: string };
      if (!query.spaceId) return fail(reply, 400, "spaceId is required");
      const accounts = await repository.listChannelAccounts(query.spaceId);
      const items = accounts.map((a) => ({
        ...a,
        token: a.token ? true : null,
      }));
      return { items };
    },
  );

  app.delete(
    "/wa/channels/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const account = await repository.getChannelAccount(id);
      if (!account) return fail(reply, 404, "channel account not found");
      await repository.deleteChannelAccount(id);
      return { ok: true };
    },
  );
}
