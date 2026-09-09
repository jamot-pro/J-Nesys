import { z } from "zod";
import { EntityBase, Id, Timestamp } from "./common.js";

/** A curated segment of people used as the source for an outreach campaign.
 * Lists are created inside the People (CRM) workspace and are space-scoped. */
export const OutreachList = EntityBase.extend({
  spaceId: Id,
  name: z.string().min(1),
  description: z.string().default(""),
  /** Person ids (People rows) that belong to this list. */
  memberPersonIds: z.array(Id).default([]),
});
export type OutreachList = z.infer<typeof OutreachList>;

export const CreateOutreachList = z.object({
  spaceId: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  memberPersonIds: z.array(Id).optional(),
});
export type CreateOutreachList = z.infer<typeof CreateOutreachList>;

export const UpdateOutreachList = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateOutreachList = z.infer<typeof UpdateOutreachList>;

/** A person joined with the context needed to reach out to them. */
export const OutreachListMember = z.object({
  personId: Id,
  actorId: Id,
  email: z.string().email().nullable(),
  displayName: z.string(),
  addedAt: Timestamp,
});
export type OutreachListMember = z.infer<typeof OutreachListMember>;

export const AddListMembers = z.object({
  personIds: z.array(Id).min(1),
});
export type AddListMembers = z.infer<typeof AddListMembers>;

export const RemoveListMembers = z.object({
  personIds: z.array(Id).min(1),
});
export type RemoveListMembers = z.infer<typeof RemoveListMembers>;

/** Delivery channel used by a single outreach step. */
export const OutreachChannel = z.enum(["whatsapp", "email", "matrix", "web"]);
export type OutreachChannel = z.infer<typeof OutreachChannel>;

export const OutreachCampaignStatus = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);
export type OutreachCampaignStatus = z.infer<typeof OutreachCampaignStatus>;

/** An outreach campaign: one source list, one assigned agent, one goal, and a
 * configurable multi-step sequence that the agent executes over time. */
export const OutreachCampaign = EntityBase.extend({
  spaceId: Id,
  name: z.string().min(1),
  description: z.string().default(""),
  /** Source list (People CRM) that defines who is reached out to. */
  listId: Id,
  /** Agent (Actor) responsible for executing the sequence. */
  agentId: Id,
  /** What the assigned agent should achieve (e.g. "book a demo call"). */
  goal: z.string().min(1),
  status: OutreachCampaignStatus.default("draft"),
  startedAt: Timestamp.nullable().default(null),
});
export type OutreachCampaign = z.infer<typeof OutreachCampaign>;

export const OutreachStep = EntityBase.extend({
  campaignId: Id,
  position: z.number().int().min(0).default(0),
  /** Days after the campaign starts before this step fires. */
  sendAfterDays: z.number().int().min(0).default(0),
  channel: OutreachChannel.default("whatsapp"),
  subject: z.string().default(""),
  /** Draft message the agent personalizes before sending. */
  template: z.string().default(""),
  /** Explicit direction for the agent on this step. */
  instructions: z.string().default(""),
});
export type OutreachStep = z.infer<typeof OutreachStep>;

export const CreateOutreachStep = z.object({
  position: z.number().int().min(0).optional(),
  sendAfterDays: z.number().int().min(0).optional(),
  channel: OutreachChannel.optional(),
  subject: z.string().optional(),
  template: z.string().optional(),
  instructions: z.string().optional(),
});
export type CreateOutreachStep = z.infer<typeof CreateOutreachStep>;

export const UpdateOutreachStep = z.object({
  position: z.number().int().min(0).optional(),
  sendAfterDays: z.number().int().min(0).optional(),
  channel: OutreachChannel.optional(),
  subject: z.string().optional(),
  template: z.string().optional(),
  instructions: z.string().optional(),
});
export type UpdateOutreachStep = z.infer<typeof UpdateOutreachStep>;

export const CreateOutreachCampaign = z.object({
  spaceId: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  listId: Id,
  agentId: Id,
  goal: z.string().min(1),
  steps: z.array(CreateOutreachStep).optional(),
});
export type CreateOutreachCampaign = z.infer<typeof CreateOutreachCampaign>;

export const UpdateOutreachCampaign = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  listId: Id.optional(),
  agentId: Id.optional(),
  goal: z.string().min(1).optional(),
  status: OutreachCampaignStatus.optional(),
});
export type UpdateOutreachCampaign = z.infer<typeof UpdateOutreachCampaign>;

/** Execution record for one (campaign, step, person) — the unit the scheduler
 * turns into a task for the campaign's assigned agent. */
export const OutreachSendStatus = z.enum([
  "queued",
  "delegated",
  "sent",
  "replied",
  "completed",
  "failed",
]);
export type OutreachSendStatus = z.infer<typeof OutreachSendStatus>;

export const OutreachSend = EntityBase.extend({
  campaignId: Id,
  stepId: Id,
  personId: Id,
  status: OutreachSendStatus.default("queued"),
  scheduledAt: Timestamp,
  taskId: Id.nullable().default(null),
  sentAt: Timestamp.nullable().default(null),
  error: z.string().nullable().default(null),
});
export type OutreachSend = z.infer<typeof OutreachSend>;