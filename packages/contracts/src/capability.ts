import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/**
 * An actionable operation derived from Skill + Connector + Policy + Context.
 * This is what Agents and Humans actually consume.
 */
export const Capability = EntityBase.extend({
  /** Human-readable, e.g. "customer.whatsapp.reply". */
  name: z.string().min(1),
  skillId: Id,
  connectorId: Id,
  policyIds: z.array(Id).default([]),
  context: z.record(z.string(), z.unknown()).default({}),
  spaceId: Id,
});
export type Capability = z.infer<typeof Capability>;
