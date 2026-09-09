import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** Mirrors the frontend's NotificationType union (notifications-context.tsx) so
 * items the API creates render with the icon/color the UI already has for each. */
export const NotificationType = z.enum([
  "approval",
  "completed",
  "warning",
  "opportunity",
  "proposal",
  "message",
]);
export type NotificationType = z.infer<typeof NotificationType>;

/** A per-actor alert surfaced in the notification bell, created by real
 * domain events (task assignment, completion, policy escalation). */
export const Notification = EntityBase.extend({
  spaceId: Id,
  /** Recipient. */
  actorId: Id,
  type: NotificationType,
  title: z.string().min(1),
  summary: z.string().default(""),
  read: z.boolean().default(false),
  /** Section to navigate to on click, e.g. "tasks". */
  targetSection: z.string().nullable().default(null),
  targetId: Id.nullable().default(null),
});
export type Notification = z.infer<typeof Notification>;
