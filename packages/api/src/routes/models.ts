import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import {
  discoverOpenAICompatibleModels,
  resolveEnabledModel,
} from "@jamot/core/llm";
import type { ModelProviderRecord } from "@jamot/core/repository";
import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  actorRoleInSpace,
  ROLE_WEIGHT,
  loadUser,
  isSuperAdminUser,
  deny,
} from "../rbac.js";
import { fail, parse } from "../util.js";
import type { RoutesOptions } from "./types.js";

const CreateProviderBody = z.object({
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().min(1).max(500),
  apiKey: z.string().trim().min(1),
  organizationId: Id.nullable().optional(),
});

const UpdateProviderBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().trim().min(1).max(500).optional(),
  apiKey: z.string().trim().min(1).optional(),
});

const ManualModelBody = z.object({
  modelId: z.string().trim().min(1).max(200),
});

const ToggleModelBody = z.object({
  enabled: z.boolean(),
});

type MaskedProvider = Omit<ModelProviderRecord, "credentialRef"> & {
  hasKey: boolean;
  models: {
    id: string;
    modelId: string;
    discovered: boolean;
    enabled: boolean;
  }[];
};

async function canAccessOrg(
  repository: JamotRepository,
  actorId: string,
  orgSpaceId: string,
  minWeight: number,
): Promise<boolean> {
  const user = await loadUser(repository, actorId);
  if (isSuperAdminUser(user)) return true;
  const role = await actorRoleInSpace(repository, actorId as Id, orgSpaceId as Id);
  if (!role) return false;
  return ROLE_WEIGHT[role] >= minWeight;
}

async function resolveOwnership(
  repository: JamotRepository,
  provider: ModelProviderRecord,
  actorId: string,
): Promise<"owner" | "member" | null> {
  if (provider.ownerActorId === actorId) return "owner";
  if (provider.ownerOrganizationId) {
    const org = await repository.getOrganization(provider.ownerOrganizationId as Id);
    if (!org) return null;
    const user = await loadUser(repository, actorId);
    if (isSuperAdminUser(user)) return "owner";
    const role = await actorRoleInSpace(repository, actorId as Id, org.spaceId as Id);
    if (!role) return null;
    return ROLE_WEIGHT[role] >= ROLE_WEIGHT.admin ? "owner" : "member";
  }
  return null;
}

async function maskProvider(
  repository: JamotRepository,
  provider: ModelProviderRecord,
): Promise<MaskedProvider> {
  const models = await repository.listProviderModels(provider.id);
  const { credentialRef: _ref, ...rest } = provider;
  return {
    ...rest,
    hasKey: true,
    models: models.map((m) => ({
      id: m.id,
      modelId: m.modelId,
      discovered: m.discovered,
      enabled: m.enabled,
    })),
  };
}

async function testAndDiscover(
  repository: JamotRepository,
  provider: ModelProviderRecord,
  apiKey: string,
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const result = await discoverOpenAICompatibleModels(provider.baseUrl, apiKey);
  await repository.updateModelProvider(provider.id, {
    status: result.ok ? "ok" : "error",
    lastTestedAt: new Date().toISOString(),
    lastError: result.ok ? null : (result.error ?? "unknown error"),
  });
  if (result.ok) {
    for (const modelId of result.models) {
      await repository.upsertProviderModel({
        providerId: provider.id,
        modelId,
        discovered: true,
      });
    }
  }
  return result;
}

/**
 * Resolve the runtime context for model resolution: the caller's accessible
 * organizationId and the effective `prefer` ref (query > agent assignment >
 * per-space orchestrator setting). Shared by /models/runtime and its debug
 * endpoint so both report identical context.
 */
async function resolveRuntimeContext(
  repository: JamotRepository,
  actorId: string,
  query: { organizationId?: string; agentId?: string; prefer?: string },
): Promise<{
  organizationId: string | null;
  prefer: string | null;
  preferSource: "query" | "agent" | "spaceSettings" | null;
  spaceSettings: { spaceId: string | null; orchestratorModel: string | null };
}> {
  let organizationId: string | null = null;
  if (query.organizationId) {
    try {
      const org = await repository.getOrganization(query.organizationId as Id);
      if (org && (await canAccessOrg(repository, actorId, org.spaceId, ROLE_WEIGHT.member))) {
        organizationId = query.organizationId;
      }
    } catch {
      // Organization lookup failed — fall through without org scope
    }
  }

  let prefer = (query.prefer as string | undefined) ?? null;
  let preferSource: "query" | "agent" | "spaceSettings" | null = prefer ? "query" : null;

  // A specific agent's assignment takes precedence when supplied. The model
  // ref is non-sensitive; resolveEnabledModel only matches it within the
  // caller's own provider scopes, so no extra authorization is needed.
  if (!prefer && query.agentId) {
    try {
      const agent = await repository.getAgent(query.agentId as Id);
      if (agent?.model) {
        prefer = agent.model;
        preferSource = "agent";
      }
    } catch {
      // Agent lookup failed — ignore
    }
  }

  // Per-space orchestrator model preference.
  const spaceSettings: { spaceId: string | null; orchestratorModel: string | null } = {
    spaceId: null,
    orchestratorModel: null,
  };
  if (!prefer) {
    let spaceId: string | null = null;
    if (organizationId) {
      try {
        const org = await repository.getOrganization(organizationId as Id);
        spaceId = org?.spaceId ?? null;
      } catch {
        // Org re-lookup failed
      }
    }
    if (!spaceId) {
      try {
        const actor = await repository.getActor(actorId);
        spaceId = actor?.personalSpaceId ?? null;
      } catch {
        // Actor lookup failed
      }
    }
    spaceSettings.spaceId = spaceId;
    if (spaceId) {
      try {
        const config = await repository.getSpaceSettings(spaceId);
        const om = config.orchestratorModel as string | null | undefined;
        spaceSettings.orchestratorModel = om ?? null;
        if (om) {
          prefer = om;
          preferSource = "spaceSettings";
        }
      } catch {
        // No settings table or read failure — fall back to first-enabled.
      }
    }
  }

  return { organizationId, prefer, preferSource, spaceSettings };
}

/**
 * Key-masked, step-by-step report of what resolveEnabledModel sees. Used to
 * explain a `configured:false` result and power /models/runtime/debug.
 */
async function inspectModelResolution(
  repository: JamotRepository,
  secretStore: { decrypt(ciphertext: string): string },
  actorId: string,
  organizationId: string | null,
  prefer: string | null,
): Promise<{
  reason: string | null;
  scopes: Array<{
    scope: "organization" | "personal";
    providers: Array<{
      id: string;
      name: string;
      modelsTotal: number;
      enabledModelIds: string[];
      secretFound: boolean;
      decryptOk: boolean | null;
      decryptError: string | null;
    }>;
  }>;
}> {
  const scopes: Array<{
    scope: "organization" | "personal";
    providers: Array<{
      id: string;
      name: string;
      modelsTotal: number;
      enabledModelIds: string[];
      secretFound: boolean;
      decryptOk: boolean | null;
      decryptError: string | null;
    }>;
  }> = [];

  let providerCount = 0;
  let enabledCount = 0;
  let secretMissing = 0;
  let decryptFailed = 0;

  const targets: Array<{ scope: "organization" | "personal"; filter: { ownerOrganizationId?: string; ownerActorId?: string } }> = [];
  if (organizationId) targets.push({ scope: "organization", filter: { ownerOrganizationId: organizationId } });
  targets.push({ scope: "personal", filter: { ownerActorId: actorId } });

  for (const target of targets) {
    const entry: { scope: "organization" | "personal"; providers: Array<{ id: string; name: string; modelsTotal: number; enabledModelIds: string[]; secretFound: boolean; decryptOk: boolean | null; decryptError: string | null }> } = {
      scope: target.scope,
      providers: [],
    };
    let providers: ModelProviderRecord[] = [];
    try {
      providers = await repository.listModelProviders(target.filter);
    } catch {
      providers = [];
    }
    for (const provider of providers) {
      providerCount++;
      let models: Array<{ modelId: string; enabled: boolean }> = [];
      try {
        models = await repository.listProviderModels(provider.id);
      } catch {
        models = [];
      }
      const enabled = models.filter((m) => m.enabled);
      enabledCount += enabled.length;

      let secretFound = false;
      let decryptOk: boolean | null = null;
      let decryptError: string | null = null;
      if (enabled.length > 0) {
        try {
          const secret = await repository.getSecret(provider.credentialRef);
          secretFound = Boolean(secret);
          if (secret) {
            try {
              secretStore.decrypt(secret.ciphertext);
              decryptOk = true;
            } catch (err) {
              decryptOk = false;
              decryptFailed++;
              decryptError = err instanceof Error ? err.message : "decrypt failed";
            }
          } else {
            secretMissing++;
          }
        } catch {
          secretMissing++;
        }
      }

      entry.providers.push({
        id: provider.id,
        name: provider.name,
        modelsTotal: models.length,
        enabledModelIds: enabled.map((m) => m.modelId),
        secretFound,
        decryptOk,
        decryptError,
      });
    }
    scopes.push(entry);
  }

  let reason: string | null = null;
  if (providerCount === 0) reason = "no_providers";
  else if (enabledCount === 0) reason = "no_enabled_models";
  else if (secretMissing > 0 && decryptFailed === 0) reason = "secret_missing";
  else if (decryptFailed > 0) reason = "decrypt_failed";
  else if (prefer) reason = "prefer_not_found";

  return { reason, scopes };
}

export default async function modelsRoutes(
  app: FastifyInstance,
  opts: RoutesOptions,
): Promise<void> {
  const { repository: rawRepository, secretStore } = opts;
  const repository = rawRepository as unknown as JamotRepository;
  /** Providers visible to the caller, with their models. No secrets. */
  app.get("/models/providers", { preHandler: requireAuth }, async (request) => {
    const actorId = request.session.actorId!;
    const query = request.query as { organizationId?: string };

    const providers: MaskedProvider[] = [];
    for (const mine of await repository.listModelProviders({ ownerActorId: actorId })) {
      providers.push(await maskProvider(repository, mine));
    }

    if (query.organizationId) {
      const org = await repository.getOrganization(query.organizationId as Id);
      if (org && (await canAccessOrg(repository, actorId, org.spaceId, ROLE_WEIGHT.member))) {
        for (const orgProvider of await repository.listModelProviders({
          ownerOrganizationId: query.organizationId,
        })) {
          providers.push(await maskProvider(repository, orgProvider));
        }
      }
    }

    return { items: providers };
  });

  /** Add a provider: store the key encrypted, then test + discover live. */
  app.post("/models/providers", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateProviderBody, request.body, reply);
    if (!body) return;
    const actorId = request.session.actorId!;

    let ownerOrganizationId: string | null = null;
    if (body.organizationId) {
      const org = await repository.getOrganization(body.organizationId);
      if (!org) return fail(reply, 404, "organization not found");
      if (!(await canAccessOrg(repository, actorId, org.spaceId, ROLE_WEIGHT.admin))) {
        return fail(reply, 403, "requires organization admin role or higher");
      }
      ownerOrganizationId = body.organizationId;
    }

    const credentialRef = `model-providers/${randomUUID()}`;
    await repository.putSecret({
      ref: credentialRef,
      scope: ownerOrganizationId ? "organization" : "user",
      ownerActorId: ownerOrganizationId ? null : actorId,
      ownerOrganizationId,
      ciphertext: secretStore.encrypt(body.apiKey),
    });

    const provider = await repository.createModelProvider({
      ownerActorId: ownerOrganizationId ? null : actorId,
      ownerOrganizationId,
      name: body.name,
      baseUrl: body.baseUrl,
      credentialRef,
    });

    const test = await testAndDiscover(repository, provider, body.apiKey);

    reply.code(201);
    return { provider: await maskProvider(repository, provider), test };
  });

  /** Update a provider; re-test + re-discover when the connection changes. */
  app.patch("/models/providers/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateProviderBody, request.body, reply);
    if (!body) return;

    const actorId = request.session.actorId!;
    const provider = await repository.getModelProvider(id);
    if (!provider) return fail(reply, 404, "provider not found");
    if ((await resolveOwnership(repository, provider, actorId)) !== "owner") {
      return fail(reply, 403, "no permission to update this provider");
    }

    const patch: Parameters<JamotRepository["updateModelProvider"]>[1] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl;
    const updated = await repository.updateModelProvider(id, patch);
    if (!updated) return fail(reply, 404, "provider not found");

    let test: { ok: boolean; models: string[]; error?: string } | null = null;
    if (body.apiKey || body.baseUrl) {
      const secret = await repository.getSecret(updated.credentialRef);
      const apiKey = body.apiKey ?? (secret ? secretStore.decrypt(secret.ciphertext) : "");
      if (body.apiKey && secret) {
        await repository.putSecret({
          ref: updated.credentialRef,
          scope: updated.ownerOrganizationId ? "organization" : "user",
          ownerActorId: updated.ownerOrganizationId ? null : updated.ownerActorId,
          ownerOrganizationId: updated.ownerOrganizationId,
          ciphertext: secretStore.encrypt(body.apiKey),
        });
      }
      if (apiKey) test = await testAndDiscover(repository, updated, apiKey);
    }

    return { provider: await maskProvider(repository, updated), test };
  });

  /** Re-run the live connection test + model discovery. */
  app.post(
    "/models/providers/:id/test",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;

      const actorId = request.session.actorId!;
      const provider = await repository.getModelProvider(id);
      if (!provider) return fail(reply, 404, "provider not found");
      const access = await resolveOwnership(repository, provider, actorId);
      if (!access) return fail(reply, 403, "no permission to test this provider");

      const secret = await repository.getSecret(provider.credentialRef);
      if (!secret) return fail(reply, 400, "provider has no stored key");
      const test = await testAndDiscover(
        repository,
        provider,
        secretStore.decrypt(secret.ciphertext),
      );
      return { provider: await maskProvider(repository, provider), test };
    },
  );

  app.delete("/models/providers/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;

    const actorId = request.session.actorId!;
    const provider = await repository.getModelProvider(id);
    if (!provider) return fail(reply, 404, "provider not found");
    if ((await resolveOwnership(repository, provider, actorId)) !== "owner") {
      return fail(reply, 403, "no permission to delete this provider");
    }

    await repository.deleteSecret(provider.credentialRef);
    await repository.deleteModelProvider(id);
    reply.code(204).send();
  });

  /** Manually add a model when discovery is unavailable. */
  app.post(
    "/models/providers/:id/models",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(ManualModelBody, request.body, reply);
      if (!body) return;

      const actorId = request.session.actorId!;
      const provider = await repository.getModelProvider(id);
      if (!provider) return fail(reply, 404, "provider not found");
      if ((await resolveOwnership(repository, provider, actorId)) !== "owner") {
        return fail(reply, 403, "no permission to edit this provider");
      }

      const model = await repository.upsertProviderModel({
        providerId: id,
        modelId: body.modelId,
        discovered: false,
      });
      reply.code(201);
      return model;
    },
  );

  /** Enable/disable an individual model. */
  app.patch(
    "/models/providers/:id/models/:modelRowId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string; modelRowId?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const modelRowId = parse(Id, params.modelRowId, reply);
      if (!modelRowId) return;
      const body = parse(ToggleModelBody, request.body, reply);
      if (!body) return;

      const actorId = request.session.actorId!;
      const provider = await repository.getModelProvider(id);
      if (!provider) return fail(reply, 404, "provider not found");
      const access = await resolveOwnership(repository, provider, actorId);
      if (!access) return fail(reply, 403, "no permission to edit this provider");

      const updated = await repository.updateProviderModel(modelRowId, {
        enabled: body.enabled,
      });
      if (!updated || updated.providerId !== id) {
        return fail(reply, 404, "model not found");
      }
      return updated;
    },
  );

  app.delete(
    "/models/providers/:id/models/:modelRowId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string; modelRowId?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const modelRowId = parse(Id, params.modelRowId, reply);
      if (!modelRowId) return;

      const actorId = request.session.actorId!;
      const provider = await repository.getModelProvider(id);
      if (!provider) return fail(reply, 404, "provider not found");
      if ((await resolveOwnership(repository, provider, actorId)) !== "owner") {
        return fail(reply, 403, "no permission to edit this provider");
      }

      await repository.deleteProviderModel(modelRowId);
      reply.code(204).send();
    },
  );

  /** Enabled models across visible providers — feeds UI selectors. */
  app.get("/models/enabled", { preHandler: requireAuth }, async (request) => {
    const actorId = request.session.actorId!;
    const query = request.query as { organizationId?: string };

    const items: {
      providerId: string;
      providerName: string;
      modelId: string;
      baseUrl: string;
    }[] = [];

    const collect = async (providers: ModelProviderRecord[]) => {
      for (const provider of providers) {
        const models = await repository.listProviderModels(provider.id);
        for (const model of models.filter((m) => m.enabled)) {
          items.push({
            providerId: provider.id,
            providerName: provider.name,
            modelId: model.modelId,
            baseUrl: provider.baseUrl,
          });
        }
      }
    };

    if (query.organizationId) {
      const org = await repository.getOrganization(query.organizationId as Id);
      if (org && (await canAccessOrg(repository, actorId, org.spaceId, ROLE_WEIGHT.member))) {
        await collect(
          await repository.listModelProviders({ ownerOrganizationId: query.organizationId }),
        );
      }
    }
    await collect(await repository.listModelProviders({ ownerActorId: actorId }));

    return { items };
  });

  /**
   * Server-side resolution for runtimes (chat, routing): the first enabled
   * model, org providers first, then personal, then env. Includes the key —
   * only ever consumed server-to-server by authenticated Jamot services.
   */
  app.get("/models/runtime", { preHandler: requireAuth }, async (request) => {
    const actorId = request.session.actorId!;
    const { organizationId, prefer } = await resolveRuntimeContext(
      repository,
      actorId,
      request.query as { organizationId?: string; agentId?: string; prefer?: string },
    );

    let resolved: Awaited<ReturnType<typeof resolveEnabledModel>> = null;
    try {
      resolved = await resolveEnabledModel({
        repo: repository,
        store: secretStore,
        organizationId,
        actorId,
        prefer,
      });
    } catch (err) {
      console.error("[models/runtime] resolution error:", err instanceof Error ? err.message : err);
      return { configured: false, reason: "resolution_error" };
    }
    if (resolved) return { configured: true, ...resolved };

    // Explain WHY nothing resolved — the CopilotKit route surfaces this.
    const report = await inspectModelResolution(
      repository,
      secretStore,
      actorId,
      organizationId,
      prefer,
    );
    return { configured: false, reason: report.reason ?? "unknown" };
  });

  /**
   * Authenticated, key-masked step-by-step report of model resolution.
   * Use this to diagnose why the chat has no model.
   */
  app.get("/models/runtime/debug", { preHandler: requireAuth }, async (request) => {
    const actorId = request.session.actorId!;
    const ctx = await resolveRuntimeContext(
      repository,
      actorId,
      request.query as { organizationId?: string; agentId?: string; prefer?: string },
    );

    const report = await inspectModelResolution(
      repository,
      secretStore,
      actorId,
      ctx.organizationId,
      ctx.prefer,
    );

    const resolved = await resolveEnabledModel({
      repo: repository,
      store: secretStore,
      organizationId: ctx.organizationId,
      actorId,
      prefer: ctx.prefer,
    });

    return {
      organizationId: ctx.organizationId,
      preferSource: ctx.preferSource,
      prefer: ctx.prefer,
      spaceSettings: ctx.spaceSettings,
      scopes: report.scopes,
      reason: resolved ? null : report.reason,
      resolved: resolved
        ? {
            providerName: resolved.providerName,
            model: resolved.model,
            baseUrl: resolved.baseUrl,
            kind: resolved.kind,
          }
        : null,
    };
  });

  // Legacy guard: old clients used GET/PUT/DELETE /models directly.
  app.get("/models", { preHandler: requireAuth }, async (_request, reply) => {
    return deny(reply, "moved to /models/providers", 410);
  });
}
