import { z } from "zod";
import { Id } from "./common.js";

export const PolicyDecision = z.enum([
  "allow",
  "deny",
  "require_human",
  "require_admin",
  "require_multisig",
]);
export type PolicyDecision = z.infer<typeof PolicyDecision>;

/**
 * Rules determining what an Actor may do. Evaluated over
 * identity × role × space × capability × resource × risk.
 */
export const Policy = z.object({
  id: Id,
  spaceId: Id,
  name: z.string().min(1),
  /** Capability name pattern or exact name to gate. */
  capability: z.string(),
  resource: z.string().default("*"),
  /** Minimum role kind required (null = any authenticated actor). */
  minRole: z.enum(["owner", "admin", "member", "agent", "external"]).nullable(),
  /** Risk threshold above which the approval requirement escalates. */
  riskThreshold: z.number().min(0).max(1).default(0.5),
  decision: PolicyDecision,
});
export type Policy = z.infer<typeof Policy>;
