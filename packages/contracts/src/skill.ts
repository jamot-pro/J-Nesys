import { z } from "zod";
import { EntityBase, Id, Provenance } from "./common.js";

/** Reusable executable knowledge. */
export const Skill = EntityBase.extend({
  ownerActorId: Id.nullable(),
  ownerOrganizationId: Id.nullable(),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Markdown specification — the authoring source of truth. */
  body: z.string().default(""),
  version: z.string().default("1.0.0"),
  inputs: z.record(z.string(), z.unknown()).default({}),
  outputs: z.record(z.string(), z.unknown()).default({}),
  prerequisites: z.array(Id).default([]),
  allowedCapabilityIds: z.array(Id).default([]),
  evaluationCriteria: z.array(z.string()).default([]),
  provenance: Provenance,
  status: z.enum(["draft", "validated", "deprecated"]).default("draft"),
});
export type Skill = z.infer<typeof Skill>;
