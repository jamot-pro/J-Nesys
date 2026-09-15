import { z } from "zod";
import { EntityBase, Id, Timestamp } from "./common.js";

/**
 * Deals: the pipeline concept behind the sales dashboard's open/won/lost
 * counts and revenue total. A deal is created deliberately — usually from a
 * lead worth pursuing — rather than inferred from lead status, so the
 * dashboard reflects what the team actually decided to work, not a guess.
 */
export const DealStage = z.enum(["open", "won", "lost"]);
export type DealStage = z.infer<typeof DealStage>;

export const Deal = EntityBase.extend({
  spaceId: Id,
  organizationId: Id.nullable().default(null),
  personId: Id.nullable().default(null),
  agentId: Id.nullable().default(null),
  createdBy: Id.nullable().default(null),
  leadListId: Id.nullable().default(null),
  title: z.string().min(1),
  valueAmount: z.number().min(0).default(0),
  currency: z.string().min(1).default("USD"),
  stage: DealStage.default("open"),
  source: z.string().nullable().default(null),
  notes: z.string().default(""),
  closedAt: Timestamp.nullable().default(null),
});
export type Deal = z.infer<typeof Deal>;

export const CreateDeal = z.object({
  spaceId: Id,
  organizationId: Id.nullable().optional(),
  personId: Id.nullable().optional(),
  agentId: Id.nullable().optional(),
  leadListId: Id.nullable().optional(),
  title: z.string().min(1),
  valueAmount: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  stage: DealStage.optional(),
  source: z.string().nullable().optional(),
  notes: z.string().optional(),
});
export type CreateDeal = z.infer<typeof CreateDeal>;

export const UpdateDeal = z.object({
  title: z.string().min(1).optional(),
  valueAmount: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  stage: DealStage.optional(),
  personId: Id.nullable().optional(),
  agentId: Id.nullable().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().optional(),
});
export type UpdateDeal = z.infer<typeof UpdateDeal>;

/** The dashboard's single realtime read: everything one homepage needs in
 * one round trip, computed server-side rather than assembled client-side
 * from several list endpoints. */
export const DashboardSummary = z.object({
  spaceId: Id,
  leadsGenerated: z.number().int().min(0),
  leadsEnriched: z.number().int().min(0),
  hotLeads: z.number().int().min(0),
  salesPeople: z.number().int().min(0),
  dealsOpen: z.number().int().min(0),
  dealsWon: z.number().int().min(0),
  dealsLost: z.number().int().min(0),
  /** Sum of won deals' valueAmount, per currency — a team rarely closes in
   * only one, and silently dropping the rest would misreport revenue. */
  revenueByCurrency: z.array(z.object({ currency: z.string(), amount: z.number() })),
  outreachCampaignsActive: z.number().int().min(0),
  outreachSent: z.number().int().min(0),
  recentDeals: z.array(Deal),
  generatedAt: Timestamp,
});
export type DashboardSummary = z.infer<typeof DashboardSummary>;
