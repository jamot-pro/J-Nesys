import { describe, expect, it } from "vitest";
import type { Policy } from "@jamot/contracts";
import { evaluate, type PolicyContext } from "./policy-engine.js";

const SPACE = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000002";

let counter = 0;
function policy(partial: Partial<Policy> & Pick<Policy, "decision">): Policy {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    spaceId: SPACE,
    name: "p",
    capability: "*",
    resource: "*",
    minRole: null,
    riskThreshold: 0.5,
    ...partial,
  } as Policy;
}

function ctx(partial: Partial<PolicyContext> = {}): PolicyContext {
  return {
    actorId: ACTOR,
    roleKind: "member",
    spaceId: SPACE,
    capability: "customer.whatsapp.reply",
    resource: "conversation/1",
    risk: 0,
    ...partial,
  };
}

describe("policy engine", () => {
  it("denies by default when no policy matches", () => {
    expect(evaluate([], ctx())).toBe("deny");
  });

  it("denies when no policy matches the capability", () => {
    const p = policy({ decision: "allow", capability: "other.capability" });
    expect(evaluate([p], ctx())).toBe("deny");
  });

  it("allows when an allow policy matches", () => {
    const p = policy({ decision: "allow", capability: "customer.whatsapp.reply" });
    expect(evaluate([p], ctx())).toBe("allow");
  });

  it("short-circuits to deny when any matching policy denies", () => {
    const allowAll = policy({ decision: "allow" });
    const denySpecific = policy({
      decision: "deny",
      capability: "customer.whatsapp.reply",
    });
    expect(evaluate([allowAll, denySpecific], ctx())).toBe("deny");
  });

  it("escalates to the most restrictive matching decision", () => {
    const allow = policy({ decision: "allow" });
    const requireHuman = policy({ decision: "require_human" });
    const requireAdmin = policy({ decision: "require_admin" });
    const requireMultisig = policy({ decision: "require_multisig" });
    expect(evaluate([allow, requireHuman], ctx())).toBe("require_human");
    expect(evaluate([allow, requireAdmin, requireHuman], ctx())).toBe(
      "require_admin",
    );
    expect(evaluate([allow, requireAdmin, requireMultisig], ctx())).toBe(
      "require_multisig",
    );
  });

  it("escalates a policy one level when risk meets its threshold", () => {
    const allow = policy({ decision: "allow", riskThreshold: 0.5 });
    expect(evaluate([allow], ctx({ risk: 0.8 }))).toBe("require_human");

    const requireHuman = policy({ decision: "require_human", riskThreshold: 0.2 });
    expect(evaluate([requireHuman], ctx({ risk: 0.3 }))).toBe("require_admin");

    const requireAdmin = policy({ decision: "require_admin", riskThreshold: 0.1 });
    expect(evaluate([requireAdmin], ctx({ risk: 0.9 }))).toBe("require_multisig");
  });

  it("does not escalate below the threshold", () => {
    const allow = policy({ decision: "allow", riskThreshold: 0.5 });
    expect(evaluate([allow], ctx({ risk: 0.1 }))).toBe("allow");
  });

  it("never escalates deny", () => {
    const deny = policy({ decision: "deny", riskThreshold: 0.0 });
    expect(evaluate([deny], ctx({ risk: 0.9 }))).toBe("deny");
  });

  it("matches capability and resource wildcards", () => {
    const wildcardCapability = policy({
      decision: "require_human",
      capability: "*",
      resource: "conversation/1",
    });
    expect(evaluate([wildcardCapability], ctx())).toBe("require_human");

    const wildcardResource = policy({
      decision: "require_admin",
      capability: "customer.whatsapp.reply",
      resource: "*",
    });
    expect(evaluate([wildcardResource], ctx())).toBe("require_admin");

    const wrongResource = policy({
      decision: "allow",
      capability: "*",
      resource: "other/resource",
    });
    expect(evaluate([wrongResource], ctx())).toBe("deny");
  });
});
