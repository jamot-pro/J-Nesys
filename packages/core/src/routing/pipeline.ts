import type {
  Actor,
  Agent,
  Person,
  Policy,
  PolicyDecision,
  Role,
  Task,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { RoleKind } from "../policy/policy-engine.js";
import { evaluate } from "../policy/policy-engine.js";
import { intentFromMessage, type LLMProvider } from "../llm/index.js";
import {
  scoreCandidate,
  type CandidateInput,
  type ScoringContext,
} from "./scoring.js";

export const INTENT_CAPABILITY_MAP: Record<string, string[]> = {
  task: ["task.execution", "workflow.run"],
  question: ["knowledge.answer", "info.retrieval"],
  meeting: ["calendar.schedule", "meeting.coordinate"],
  finance: ["finance.invoice", "treasury.payment"],
  unknown: ["generic.assist"],
};

const ROLE_RANK: Record<RoleKind, number> = {
  owner: 5,
  admin: 4,
  member: 3,
  agent: 2,
  external: 1,
};

const DECISION_RANK: Record<PolicyDecision, number> = {
  allow: 0,
  require_human: 1,
  require_admin: 2,
  require_multisig: 3,
  deny: 4,
};

const AGENT_LATENCY_MS = 500;
const HUMAN_LATENCY_MS = 3_600_000;
const CONTINUITY_REF = 5;

export interface RoutingRequest {
  spaceId: string;
  message: string;
  risk?: number;
}

export interface CandidateSummary {
  actorId: string;
  actorType: Actor["type"];
  roleKind: RoleKind | null;
  score: number;
  breakdown: Record<string, number>;
  decision: PolicyDecision;
}

export interface RoutingResult {
  intent: string;
  requiredCapabilities: string[];
  candidates: CandidateSummary[];
  assignment?: { actorId: string; targetType: Task["targetType"] };
  decision: PolicyDecision;
}

function roleRank(kind: RoleKind | null): number {
  return kind === null ? 0 : ROLE_RANK[kind];
}

function policyBlocksRole(
  policies: Policy[],
  spaceId: string,
  capability: string,
  roleKind: RoleKind | null,
): boolean {
  return policies.some(
    (policy) =>
      policy.spaceId === spaceId &&
      (policy.capability === "*" || policy.capability === capability) &&
      policy.minRole !== null &&
      roleRank(roleKind) < roleRank(policy.minRole),
  );
}

function candidateDecision(
  policies: Policy[],
  candidate: CandidateInput,
  spaceId: string,
  requiredCapabilities: string[],
  risk: number,
): PolicyDecision {
  let best: PolicyDecision = "allow";
  for (const capability of requiredCapabilities) {
    const decision = evaluate(policies, {
      actorId: candidate.actorId,
      roleKind: candidate.roleKind,
      spaceId,
      capability,
      resource: "*",
      risk,
    });
    const blocked = policyBlocksRole(
      policies,
      spaceId,
      capability,
      candidate.roleKind,
    );
    const effective: PolicyDecision = blocked ? "deny" : decision;
    if (DECISION_RANK[effective] > DECISION_RANK[best]) best = effective;
  }
  return best;
}

function overallDecision(candidates: CandidateSummary[]): PolicyDecision {
  if (candidates.length === 0) return "deny";
  if (candidates.some((candidate) => candidate.decision === "allow")) {
    return "allow";
  }
  let best: PolicyDecision = "deny";
  for (const candidate of candidates) {
    if (DECISION_RANK[candidate.decision] < DECISION_RANK[best]) {
      best = candidate.decision;
    }
  }
  return best;
}

function extractIntent(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { intent?: unknown };
    if (typeof parsed.intent === "string" && parsed.intent.length > 0) {
      return parsed.intent;
    }
  } catch {
    // fall through to tolerant extraction
  }
  const match = text.match(/\{[\s\S]*"intent"[\s\S]*?\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { intent?: unknown };
      if (typeof parsed.intent === "string" && parsed.intent.length > 0) {
        return parsed.intent;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function resolveIntent(llm: LLMProvider, message: string): Promise<string> {
  try {
    const result = await llm.complete([
      {
        role: "system",
        content:
          'Classify the intent of the user request. Respond with ONLY a JSON object and no other text: {"intent":"task"|"question"|"meeting"|"finance"|"unknown"}.',
      },
      { role: "user", content: message },
    ]);
    const intent = extractIntent(result.content);
    if (intent) return intent;
  } catch {
    // fall back to the keyword heuristic
  }
  return intentFromMessage(message);
}

export type ModelConfigResolver = (spaceId: string) => Promise<LLMProvider | null>;

export function createRoutingPipeline(deps: {
  repo: JamotRepository;
  llm: LLMProvider;
  resolveModelConfig?: ModelConfigResolver;
}): { route(req: RoutingRequest): Promise<RoutingResult> } {
  const { repo, llm, resolveModelConfig } = deps;

  async function route(req: RoutingRequest): Promise<RoutingResult> {
    const risk = req.risk ?? 0;
    const provider = (resolveModelConfig ? await resolveModelConfig(req.spaceId) : null) ?? llm;
    const intent = await resolveIntent(provider, req.message);
    const requiredCapabilities =
      INTENT_CAPABILITY_MAP[intent] ?? INTENT_CAPABILITY_MAP["unknown"] ?? [];

    const roles = await repo.listRolesForSpace(req.spaceId);
    const roleKindByActor = new Map<string, RoleKind>();
    for (const role of roles) {
      const existing = roleKindByActor.get(role.actorId);
      if (existing === undefined || ROLE_RANK[role.kind] > ROLE_RANK[existing]) {
        roleKindByActor.set(role.actorId, role.kind);
      }
    }
    const memberIds = new Set(roleKindByActor.keys());

    const [agents, actors, people, policies, tasks] = await Promise.all([
      repo.listAgents(),
      repo.listActors(),
      repo.listPeople(),
      repo.listPolicies({ spaceId: req.spaceId }),
      repo.listTasks({ spaceId: req.spaceId }),
    ]);

    const personByActorId = new Map<string, Person>(
      people.map((person) => [person.actorId, person]),
    );
    const priorByActorId = new Map<string, number>();
    for (const task of tasks) {
      for (const assigneeId of task.assigneeActorIds) {
        priorByActorId.set(
          assigneeId,
          (priorByActorId.get(assigneeId) ?? 0) + 1,
        );
      }
    }

    const candidates: CandidateInput[] = [];

    for (const agent of agents) {
      if (!memberIds.has(agent.actorId)) continue;
      if (agent.budget != null && agent.budget <= 0) continue; // no budget left
      const kind = roleKindByActor.get(agent.actorId) ?? null;
      candidates.push({
        actorId: agent.actorId,
        actorType: "agent",
        roleKind: kind,
        capabilityIds: agent.capabilityIds,
        skillIds: agent.skillIds,
        performance: agent.performance,
        availability: agent.availability,
        budget: agent.budget,
        reputation: {},
        permissions: agent.permissions,
        latencyMs: AGENT_LATENCY_MS,
        continuity: Math.min(
          1,
          (priorByActorId.get(agent.actorId) ?? 0) / CONTINUITY_REF,
        ),
        risk: kind === "external" ? 0.5 : 0,
      });
    }

    for (const actor of actors) {
      if (actor.type !== "human") continue;
      if (!memberIds.has(actor.id)) continue;
      const kind = roleKindByActor.get(actor.id) ?? null;
      const person = personByActorId.get(actor.id);
      candidates.push({
        actorId: actor.id,
        actorType: "human",
        roleKind: kind,
        capabilityIds: [],
        skillIds: person?.profile.skills ?? [],
        performance: {},
        availability: actor.status === "active" ? "available" : "offline",
        budget: null,
        reputation: person?.reputation ?? {},
        permissions: [],
        latencyMs: HUMAN_LATENCY_MS,
        continuity: Math.min(
          1,
          (priorByActorId.get(actor.id) ?? 0) / CONTINUITY_REF,
        ),
        risk: kind === "external" ? 0.5 : 0,
      });
    }

    const ctx: ScoringContext = { requiredCapabilities, risk };

    const scored: CandidateSummary[] = [];
    for (const candidate of candidates) {
      const decision = candidateDecision(
        policies,
        candidate,
        req.spaceId,
        requiredCapabilities,
        risk,
      );
      if (decision === "deny") continue;
      const { total, breakdown } = scoreCandidate(candidate, ctx);
      scored.push({
        actorId: candidate.actorId,
        actorType: candidate.actorType,
        roleKind: candidate.roleKind,
        score: total,
        breakdown,
        decision,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const winner = scored.find((candidate) => candidate.decision === "allow");
    const assignment = winner
      ? { actorId: winner.actorId, targetType: winner.actorType }
      : undefined;

    return {
      intent,
      requiredCapabilities,
      candidates: scored,
      assignment,
      decision: overallDecision(scored),
    };
  }

  return { route };
}
