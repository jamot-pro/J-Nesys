import type { JamotRepository } from "../repository/repository.js";
import type { AppManifest, AppRegistry } from "../apps/registry.js";

export interface ResolverInput {
  spaceId: string;
  organizationId: string;
  actorRole: string;
  requiredCapabilities: string[];
  context?: Record<string, unknown>;
}

export interface ResolverOutput {
  orderedAppIds: string[];
  availableCapabilities: string[];
}

export interface AppResolverDeps {
  repo: JamotRepository;
  apps: AppRegistry;
}

export interface AppResolver {
  resolve(input: ResolverInput): Promise<ResolverOutput>;
}

const ROLE_WEIGHT: Record<string, number> = {
  owner: 5,
  admin: 4,
  member: 3,
  agent: 2,
  external: 1,
};

const roleWeight = (role: string): number => ROLE_WEIGHT[role] ?? 0;

function permits(app: AppManifest, actorRole: string): boolean {
  const actor = roleWeight(actorRole);
  return app.permissions.every((permission) => roleWeight(permission) <= actor);
}

function coverage(app: AppManifest, required: string[]): number {
  const have = new Set(app.capabilities);
  return required.filter((capability) => have.has(capability)).length;
}

export function createAppResolver(deps: AppResolverDeps): AppResolver {
  async function resolve(input: ResolverInput): Promise<ResolverOutput> {
    const organization = await deps.repo.getOrganization(input.organizationId);
    if (!organization) {
      return { orderedAppIds: [], availableCapabilities: [] };
    }

    const enabled = new Set<string>(organization.enabledAppIds);

    const candidates = deps.apps
      .list()
      .filter((app) => enabled.has(app.id))
      .filter((app) => permits(app, input.actorRole));

    const ordered = [...candidates].sort((a, b) => {
      const byCoverage =
        coverage(b, input.requiredCapabilities) -
        coverage(a, input.requiredCapabilities);
      if (byCoverage !== 0) return byCoverage;
      return a.id.localeCompare(b.id);
    });

    const spaceCapabilities = new Set<string>(
      (await deps.repo.listCapabilities({ spaceId: input.spaceId })).map(
        (capability) => capability.name,
      ),
    );

    const availableCapabilities = [
      ...new Set<string>(ordered.flatMap((app) => app.capabilities)),
    ]
      .filter((name) => spaceCapabilities.has(name))
      .sort();

    return {
      orderedAppIds: ordered.map((app) => app.id),
      availableCapabilities,
    };
  }

  return { resolve };
}
