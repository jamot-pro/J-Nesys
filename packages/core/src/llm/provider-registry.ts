import type { JamotRepository } from "../repository/repository.js";
import type { SecretStore } from "../secrets/secret-store.js";

/**
 * Provider-agnostic model configuration.
 *
 * A "provider" is any OpenAI-compatible endpoint (OpenAI, OpenRouter,
 * local/self-hosted gateways, future providers). Nothing here is hardcoded
 * to a vendor: Provider / Credential → Connection Test → Model Discovery →
 * Available Models → Enabled Models.
 */

export interface ModelDiscoveryResult {
  ok: boolean;
  models: string[];
  error?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/**
 * Live connection test + model discovery against an OpenAI-compatible
 * `GET /models` endpoint. Handles `{data:[{id}]}`, `[{id}]` and `["id"]`
 * response shapes used by different gateways.
 */
export async function discoverOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string,
): Promise<ModelDiscoveryResult> {
  const base = normalizeBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        models: [],
        error: `connection failed (HTTP ${res.status})`,
      };
    }
    const data = (await res.json()) as unknown;

    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as { data?: unknown[] })?.data)
        ? ((data as { data: unknown[] }).data)
        : [];

    const models = list
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const id = (entry as { id?: unknown }).id;
          return typeof id === "string" ? id : null;
        }
        return null;
      })
      .filter((id): id is string => Boolean(id));

    return { ok: true, models };
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return {
      ok: false,
      models: [],
      error: aborted ? "connection timed out" : `connection failed (${(err as Error).message})`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RuntimeModel {
  /** Adapter kind used by createLLMProvider. */
  kind: "openai" | "anthropic";
  model: string;
  baseUrl?: string;
  apiKey: string;
  providerName: string;
}

export interface ResolveEnabledModelInput {
  repo: JamotRepository;
  store: SecretStore;
  /** Organization providers take precedence when present. */
  organizationId?: string | null;
  actorId?: string | null;
  env?: NodeJS.ProcessEnv;
  /**
   * Preferred model reference, encoded as `providerId::modelId`. If an enabled
   * model on a reachable provider matches, it is returned ahead of the
   * first-enabled default.
   */
  prefer?: string | null;
}

/** Encode/decode a `providerId::modelId` model reference. */
export function encodeModelRef(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export function decodeModelRef(ref: string | null | undefined): {
  providerId: string;
  modelId: string;
} | null {
  if (!ref || !ref.includes("::")) return null;
  const idx = ref.indexOf("::");
  return { providerId: ref.slice(0, idx), modelId: ref.slice(idx + 2) };
}

/**
 * Pick the model the platform should use right now: the first enabled model
 * of the org's providers, then the user's providers, then environment
 * fallbacks. Only enabled models are ever returned. A `prefer` ref, when it
 * matches an enabled model on a reachable provider, takes precedence.
 */
export async function resolveEnabledModel(
  input: ResolveEnabledModelInput,
): Promise<RuntimeModel | null> {
  const { repo, store, organizationId, actorId } = input;
  const env = input.env ?? process.env;
  const prefer = decodeModelRef(input.prefer);

  const scopes: Array<{ ownerOrganizationId?: string; ownerActorId?: string }> = [];
  if (organizationId) scopes.push({ ownerOrganizationId: organizationId });
  if (actorId) scopes.push({ ownerActorId: actorId });

  let firstEnabled: RuntimeModel | null = null;

  for (const scope of scopes) {
    const providers = await repo.listModelProviders(scope);
    for (const provider of providers) {
      const models = await repo.listProviderModels(provider.id);
      const enabled = models.filter((m) => m.enabled);
      for (const model of enabled) {
        const secret = await repo.getSecret(provider.credentialRef);
        if (!secret) continue;
        let apiKey: string;
        try {
          apiKey = store.decrypt(secret.ciphertext);
        } catch {
          continue;
        }
        const resolved: RuntimeModel = {
          kind: "openai",
          model: model.modelId,
          baseUrl: provider.baseUrl,
          apiKey,
          providerName: provider.name,
        };
        if (
          prefer &&
          prefer.providerId === provider.id &&
          prefer.modelId === model.modelId
        ) {
          return resolved;
        }
        if (!firstEnabled) firstEnabled = resolved;
      }
    }
  }

  if (firstEnabled) return firstEnabled;

  if (env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      providerName: "OPENAI_API_KEY (env)",
    };
  }
  if (env.ANTHROPIC_API_KEY) {
    return {
      kind: "anthropic",
      model: env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
      baseUrl: env.ANTHROPIC_BASE_URL,
      apiKey: env.ANTHROPIC_API_KEY,
      providerName: "ANTHROPIC_API_KEY (env)",
    };
  }
  return null;
}
