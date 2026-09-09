import { z } from "zod";
import { EntityBase, Id, Provenance } from "./common.js";

export const ActorType = z.enum(["human", "agent"]);
export type ActorType = z.infer<typeof ActorType>;

export const ActorSource = z.enum(["internal", "external"]);
export type ActorSource = z.infer<typeof ActorSource>;

export const ActorStatus = z.enum(["active", "inactive", "suspended"]);
export type ActorStatus = z.infer<typeof ActorStatus>;

/** External protocol identity (Matrix, DID, Nostr, wallet, email, phone, ...). */
export const ExternalIdentity = z.object({
  provider: z.string().min(1),
  value: z.string().min(1),
  verified: z.boolean().default(false),
});
export type ExternalIdentity = z.infer<typeof ExternalIdentity>;

/** Universal representation of a participant. */
export const Actor = EntityBase.extend({
  type: ActorType,
  source: ActorSource.default("internal"),
  displayName: z.string().min(1),
  status: ActorStatus.default("active"),
  externalIdentities: z.array(ExternalIdentity).default([]),
  /** Personal space that owns this actor (null for org-only external actors). */
  personalSpaceId: Id.nullable(),
});
export type Actor = z.infer<typeof Actor>;
