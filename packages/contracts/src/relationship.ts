import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** Kind of relationship between two Actors. */
export const RelationshipKind = z.enum([
  "reports_to",
  "manages",
  "collaborates_with",
  "delegates_to",
  "receives_tasks_from",
  "supports",
]);
export type RelationshipKind = z.infer<typeof RelationshipKind>;

/** Directed relationship between two Actors (e.g. an Agent reports to a Human). */
export const Relationship = EntityBase.extend({
  fromActorId: Id,
  toActorId: Id,
  kind: RelationshipKind,
});
export type Relationship = z.infer<typeof Relationship>;

/** Body for creating a relationship. */
export const CreateRelationshipBody = z.object({
  fromActorId: Id,
  toActorId: Id,
  kind: RelationshipKind,
});
export type CreateRelationshipBody = z.infer<typeof CreateRelationshipBody>;