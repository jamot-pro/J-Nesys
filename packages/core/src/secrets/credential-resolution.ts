import type { JamotRepository } from "../repository/repository.js";
import type { SecretStore } from "./secret-store.js";

export interface CredentialResolverDeps {
  repo: JamotRepository;
  store: SecretStore;
  env?: NodeJS.ProcessEnv;
}

export interface CredentialResolver {
  resolveCredential(ref: string): Promise<string | null>;
}

export function createCredentialResolver(
  deps: CredentialResolverDeps,
): CredentialResolver {
  const { repo, store } = deps;
  const env = deps.env ?? process.env;

  return {
    async resolveCredential(ref) {
      const secret = await repo.getSecret(ref);
      if (!secret) return null;

      if (secret.scope === "environment") {
        const value = env[ref];
        return typeof value === "string" && value.length > 0 ? value : null;
      }

      try {
        return store.decrypt(secret.ciphertext);
      } catch {
        return null;
      }
    },
  };
}
