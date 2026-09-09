import type { Policy, PolicyDecision } from "@jamot/contracts";

export type { PolicyDecision } from "@jamot/contracts";

export type RoleKind = "owner" | "admin" | "member" | "agent" | "external";

export type PolicyContext = {
  actorId: string;
  roleKind: RoleKind | null;
  spaceId: string;
  capability: string;
  resource: string;
  risk: number;
};

const RANK: Record<PolicyDecision, number> = {
  allow: 0,
  require_human: 1,
  require_admin: 2,
  require_multisig: 3,
  deny: 4,
};

const ESCALATE: Record<Exclude<PolicyDecision, "deny">, PolicyDecision> = {
  allow: "require_human",
  require_human: "require_admin",
  require_admin: "require_multisig",
  require_multisig: "require_multisig",
};

function matches(policy: Policy, ctx: PolicyContext): boolean {
  if (policy.spaceId !== ctx.spaceId) return false;
  if (policy.capability !== "*" && policy.capability !== ctx.capability) {
    return false;
  }
  if (policy.resource !== "*" && policy.resource !== ctx.resource) {
    return false;
  }
  return true;
}

function effectiveDecision(policy: Policy, ctx: PolicyContext): PolicyDecision {
  if (policy.decision === "deny") return "deny";
  if (ctx.risk >= policy.riskThreshold) return ESCALATE[policy.decision];
  return policy.decision;
}

export function evaluate(
  policies: Policy[],
  ctx: PolicyContext,
): PolicyDecision {
  const matched = policies.filter((policy) => matches(policy, ctx));
  if (matched.length === 0) return "deny";
  if (matched.some((policy) => effectiveDecision(policy, ctx) === "deny")) {
    return "deny";
  }
  let best: PolicyDecision = "allow";
  for (const policy of matched) {
    const decision = effectiveDecision(policy, ctx);
    if (RANK[decision] > RANK[best]) {
      best = decision;
    }
  }
  return best;
}
