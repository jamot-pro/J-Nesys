import { describe, expect, it } from "vitest";
import type { Capability, Organization } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import { createAppRegistry, type AppManifest } from "../apps/registry.js";
import { createAppResolver } from "./resolver.js";

const SPACE = "00000000-0000-4000-8000-000000000001";
const ORG = "00000000-0000-4000-8000-000000000002";
const TS = new Date().toISOString();

function app(
  partial: Partial<AppManifest> & Pick<AppManifest, "id">,
): AppManifest {
  return {
    name: partial.name ?? partial.id,
    version: "1.0.0",
    description: "",
    entities: [],
    capabilities: [],
    tools: [],
    events: [],
    hooks: [],
    settings: {},
    canvas: [],
    permissions: [],
    ...partial,
  };
}

function makeOrg(enabledAppIds: string[]): Organization {
  return {
    id: ORG,
    createdAt: TS,
    updatedAt: TS,
    spaceId: SPACE,
    dream: "",
    blueprint: {},
    enabledAppIds,
    treasuryId: null,
    reputation: {},
  } as unknown as Organization;
}

function makeCap(name: string): Capability {
  return {
    id: "00000000-0000-4000-8000-0000000000c0",
    createdAt: TS,
    updatedAt: TS,
    name,
    skillId: "00000000-0000-4000-8000-0000000000c1",
    connectorId: "00000000-0000-4000-8000-0000000000c2",
    policyIds: [],
    context: {},
    spaceId: SPACE,
  } as unknown as Capability;
}

function fakeRepo(
  org: Organization | null,
  caps: string[],
): JamotRepository {
  return {
    async getOrganization() {
      return org;
    },
    async listCapabilities() {
      return caps.map(makeCap);
    },
  } as unknown as JamotRepository;
}

function input(overrides: {
  organizationId?: string;
  actorRole?: string;
  requiredCapabilities?: string[];
} = {}) {
  return {
    spaceId: SPACE,
    organizationId: ORG,
    actorRole: "member",
    requiredCapabilities: [] as string[],
    ...overrides,
  };
}

describe("app resolver", () => {
  it("filters to enabled apps", async () => {
    const registry = createAppRegistry([]);
    registry.register(app({ id: "enabled" }));
    registry.register(app({ id: "disabled" }));

    const resolver = createAppResolver({
      repo: fakeRepo(makeOrg(["enabled"]), []),
      apps: registry,
    });

    const out = await resolver.resolve(input());
    expect(out.orderedAppIds).toEqual(["enabled"]);
  });

  it("excludes apps whose permissions exceed the actor role", async () => {
    const registry = createAppRegistry([]);
    registry.register(app({ id: "admin-app", permissions: ["admin"] }));
    registry.register(app({ id: "member-app", permissions: ["member"] }));

    const repo = fakeRepo(makeOrg(["admin-app", "member-app"]), []);

    const member = await createAppResolver({ repo, apps: registry }).resolve(
      input({ actorRole: "member" }),
    );
    expect(member.orderedAppIds).toEqual(["member-app"]);

    const admin = await createAppResolver({ repo, apps: registry }).resolve(
      input({ actorRole: "admin" }),
    );
    expect(admin.orderedAppIds).toEqual(["admin-app", "member-app"]);
  });

  it("orders by capability coverage, then by id", async () => {
    const registry = createAppRegistry([]);
    registry.register(app({ id: "z-many", capabilities: ["a", "b", "c"] }));
    registry.register(app({ id: "a-none", capabilities: [] }));
    registry.register(app({ id: "m-one", capabilities: ["b"] }));

    const resolver = createAppResolver({
      repo: fakeRepo(makeOrg(["z-many", "a-none", "m-one"]), []),
      apps: registry,
    });

    const out = await resolver.resolve(
      input({ actorRole: "owner", requiredCapabilities: ["a", "b", "c"] }),
    );
    expect(out.orderedAppIds).toEqual(["z-many", "m-one", "a-none"]);
  });

  it("breaks coverage ties by id for deterministic ordering", async () => {
    const registry = createAppRegistry([]);
    registry.register(app({ id: "beta", capabilities: ["a"] }));
    registry.register(app({ id: "alpha", capabilities: ["a"] }));

    const resolver = createAppResolver({
      repo: fakeRepo(makeOrg(["beta", "alpha"]), []),
      apps: registry,
    });

    const out = await resolver.resolve(
      input({ actorRole: "owner", requiredCapabilities: ["a"] }),
    );
    expect(out.orderedAppIds).toEqual(["alpha", "beta"]);
  });

  it("computes availableCapabilities as the intersection with space capabilities", async () => {
    const registry = createAppRegistry([]);
    registry.register(
      app({ id: "x", capabilities: ["contact.manage", "not.in.space"] }),
    );

    const resolver = createAppResolver({
      repo: fakeRepo(makeOrg(["x"]), ["contact.manage", "pipeline.track"]),
      apps: registry,
    });

    const out = await resolver.resolve(input({ actorRole: "owner" }));
    expect(out.availableCapabilities).toEqual(["contact.manage"]);
  });

  it("returns empty output when the organization is missing", async () => {
    const registry = createAppRegistry([]);
    registry.register(app({ id: "x" }));

    const resolver = createAppResolver({
      repo: fakeRepo(null, []),
      apps: registry,
    });

    const out = await resolver.resolve(input({ organizationId: "missing" }));
    expect(out).toEqual({ orderedAppIds: [], availableCapabilities: [] });
  });
});
