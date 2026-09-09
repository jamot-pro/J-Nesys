import { describe, expect, it } from "vitest";
import type {
  Actor,
  Agent,
  Person,
  Policy,
  Role,
  Task,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import { createMockProvider, intentFromMessage } from "../llm/mock.js";
import type { LLMProvider } from "../llm/provider.js";
import { createRoutingPipeline } from "./pipeline.js";
import { scoreCandidate, type CandidateInput } from "./scoring.js";

const SPACE = "00000000-0000-4000-8000-000000000001";
const MEMBER = "00000000-0000-4000-8000-00000000000a";
const EXTERNAL = "00000000-0000-4000-8000-00000000000b";
const AGENT = "00000000-0000-4000-8000-00000000000c";

function role(actorId: string, kind: Role["kind"]): Role {
  return { actorId, spaceId: SPACE, kind } as unknown as Role;
}

function agent(actorId: string): Agent {
  return {
    actorId,
    capabilityIds: ["task.execution"],
    skillIds: [],
    performance: {},
    availability: "available",
    budget: null,
    permissions: [],
  } as unknown as Agent;
}

function humanActor(actorId: string): Actor {
  return { id: actorId, type: "human", status: "active" } as unknown as Actor;
}

function policy(overrides: Partial<Policy>): Policy {
  return {
    spaceId: SPACE,
    name: "p",
    capability: "*",
    resource: "*",
    minRole: null,
    riskThreshold: 0.5,
    decision: "allow",
    ...overrides,
  } as unknown as Policy;
}

function repo(seed: {
  roles?: Role[];
  agents?: Agent[];
  actors?: Actor[];
  people?: Person[];
  policies?: Policy[];
  tasks?: Task[];
}): JamotRepository {
  return {
    async listRolesForSpace(spaceId) {
      return (seed.roles ?? []).filter((r) => r.spaceId === spaceId);
    },
    async listAgents() {
      return seed.agents ?? [];
    },
    async listActors() {
      return seed.actors ?? [];
    },
    async listPeople() {
      return seed.people ?? [];
    },
    async listPolicies(filter) {
      if (!filter?.spaceId) return seed.policies ?? [];
      return (seed.policies ?? []).filter((p) => p.spaceId === filter.spaceId);
    },
    async listTasks(filter) {
      if (!filter?.spaceId) return seed.tasks ?? [];
      return (seed.tasks ?? []).filter((t) => t.spaceId === filter.spaceId);
    },
  } as JamotRepository;
}

describe("mock provider", () => {
  it("maps keywords to intents deterministically", () => {
    expect(intentFromMessage("create a task for me")).toBe("task");
    expect(intentFromMessage("schedule a meeting tomorrow")).toBe("meeting");
    expect(intentFromMessage("pay the invoice")).toBe("finance");
    expect(intentFromMessage("random words")).toBe("unknown");
  });

  it("extracts intent as JSON and never throws", async () => {
    const provider = createMockProvider();
    const result = await provider.complete([
      { role: "user", content: "what is a question" },
    ]);
    expect(JSON.parse(result.content)).toEqual({ intent: "question" });
  });
});

describe("routing pipeline", () => {
  it("extracts intent via the LLM and falls back to the heuristic", async () => {
    const empty = repo({});
    const pipeline = createRoutingPipeline({
      repo: empty,
      llm: createMockProvider(),
    });

    const viaMock = await pipeline.route({
      spaceId: SPACE,
      message: "please create a task",
    });
    expect(viaMock.intent).toBe("task");
    expect(viaMock.requiredCapabilities).toEqual([
      "task.execution",
      "workflow.run",
    ]);

    const throwing: LLMProvider = {
      name: "boom",
      async complete() {
        throw new Error("boom");
      },
    };
    const fallback = await createRoutingPipeline({
      repo: empty,
      llm: throwing,
    }).route({ spaceId: SPACE, message: "schedule a meeting" });
    expect(fallback.intent).toBe("meeting");
  });

  it("rejects a low-role actor via policy", async () => {
    const pipeline = createRoutingPipeline({
      repo: repo({
        roles: [role(MEMBER, "member"), role(EXTERNAL, "external")],
        actors: [humanActor(MEMBER), humanActor(EXTERNAL)],
        policies: [policy({ decision: "allow", minRole: "member" })],
      }),
      llm: createMockProvider(),
    });

    const result = await pipeline.route({
      spaceId: SPACE,
      message: "create a task",
    });

    const ids = result.candidates.map((candidate) => candidate.actorId);
    expect(ids).toContain(MEMBER);
    expect(ids).not.toContain(EXTERNAL);
  });

  it("produces an assignment when policy allows", async () => {
    const pipeline = createRoutingPipeline({
      repo: repo({
        roles: [role(AGENT, "agent")],
        agents: [agent(AGENT)],
        policies: [policy({ decision: "allow" })],
      }),
      llm: createMockProvider(),
    });

    const result = await pipeline.route({
      spaceId: SPACE,
      message: "please create a task",
    });

    expect(result.decision).toBe("allow");
    expect(result.assignment).toEqual({ actorId: AGENT, targetType: "agent" });
  });

  it("produces no assignment when every candidate is denied", async () => {
    const pipeline = createRoutingPipeline({
      repo: repo({
        roles: [role(MEMBER, "member")],
        actors: [humanActor(MEMBER)],
        policies: [policy({ decision: "deny" })],
      }),
      llm: createMockProvider(),
    });

    const result = await pipeline.route({
      spaceId: SPACE,
      message: "create a task",
    });

    expect(result.decision).toBe("deny");
    expect(result.assignment).toBeUndefined();
    expect(result.candidates).toHaveLength(0);
  });

  it("excludes agents with no remaining budget", async () => {
    const budgetExhausted = { ...agent(AGENT), budget: 0 } as Agent;
    const pipeline = createRoutingPipeline({
      repo: repo({
        roles: [role(AGENT, "agent")],
        agents: [budgetExhausted],
        policies: [policy({ decision: "allow" })],
      }),
      llm: createMockProvider(),
    });

    const result = await pipeline.route({
      spaceId: SPACE,
      message: "please create a task",
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.assignment).toBeUndefined();
  });
});

describe("scoring", () => {
  it("prefers a higher-reputation agent", () => {
    const base: CandidateInput = {
      actorId: AGENT,
      actorType: "agent",
      roleKind: "agent",
      capabilityIds: ["task.execution"],
      skillIds: [],
      performance: {},
      availability: "available",
      budget: null,
      reputation: {},
      permissions: [],
      latencyMs: 500,
      continuity: 0.5,
      risk: 0,
    };

    const ctx = { requiredCapabilities: ["task.execution"], risk: 0 };

    const high = scoreCandidate({ ...base, reputation: { quality: 1 } }, ctx);
    const low = scoreCandidate({ ...base, reputation: { quality: 0.1 } }, ctx);

    expect(high.total).toBeGreaterThan(low.total);
    expect(high.breakdown.reputation!).toBeGreaterThan(low.breakdown.reputation!);
  });
});
