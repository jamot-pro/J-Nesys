import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** Abstraction seam for payment rails (JAMOT_SPEC §31 — never hard-code one rail). */
export const PaymentProviderKind = z.enum(["ledger", "card", "bank", "stablecoin"]);
export type PaymentProviderKind = z.infer<typeof PaymentProviderKind>;

export const PaymentIntentStatus = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
]);
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatus>;

/** A payment intent created against an approved PurchaseOrder. */
export const PaymentIntent = EntityBase.extend({
  purchaseOrderId: Id,
  buyerOrganizationId: Id,
  sellerOrganizationId: Id,
  spaceId: Id.nullable().optional(),
  currency: z.string().default("USD"),
  estimatedAmount: z.number().positive(),
  status: PaymentIntentStatus,
  provider: PaymentProviderKind.default("ledger"),
  requiresApproval: z.boolean().default(true),
  approvedByActorId: Id.nullable().default(null),
  providerReference: z.string().nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type PaymentIntent = z.infer<typeof PaymentIntent>;

/** Execution record once an intent settles. */
export const PaymentRecord = EntityBase.extend({
  paymentIntentId: Id,
  spaceId: Id.nullable().optional(),
  paidAmount: z.number().positive(),
  currency: z.string().default("USD"),
  providerReference: z.string().nullable().default(null),
  settledAt: z.string().nullable(),
});
export type PaymentRecord = z.infer<typeof PaymentRecord>;