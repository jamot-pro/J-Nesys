import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/**
 * A channel-specific identity (WhatsApp number, Telegram id, email, Google
 * resource, ...) that resolves to ONE canonical Person. Identities are never
 * merged blindly — uncertain matches become MergeCandidates for human review.
 */
export const Identity = EntityBase.extend({
  actorId: Id,
  /** Person this identity currently resolves to (null while unresolved). */
  personId: Id.nullable(),
  provider: z.string().min(1),
  value: z.string().min(1),
  verified: z.boolean().default(true),
  /** 0..1 — how strongly this identity is believed to belong to the person. */
  confidence: z.number().min(0).max(1).default(1),
  /** Where the identity came from (channel name, "google_contacts", "manual"). */
  source: z.string().default("observed"),
});
export type Identity = z.infer<typeof Identity>;

export const MergeCandidateStatus = z.enum(["pending", "merged", "dismissed"]);
export type MergeCandidateStatus = z.infer<typeof MergeCandidateStatus>;

/**
 * Two People that may be the same human. Created automatically when identity
 * signals collide; resolved only by an explicit human decision.
 */
export const MergeCandidate = EntityBase.extend({
  spaceId: Id.nullable(),
  personAId: Id,
  personBId: Id,
  reason: z.string(),
  detail: z.record(z.string(), z.unknown()).default({}),
  status: MergeCandidateStatus.default("pending"),
});
export type MergeCandidate = z.infer<typeof MergeCandidate>;
