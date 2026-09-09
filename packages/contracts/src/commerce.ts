import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** Supplier-as-a-role on an Actor. */
export const Supplier = EntityBase.extend({
  actorId: Id,
  /** Legal/commercial counterparty (catalog owner, invoicing). Nullable for solo suppliers. */
  organizationId: Id.nullable(),
  onboardingStatus: z
    .enum(["invited", "active", "suspended"])
    .default("active"),
  defaultCurrency: z.string().default("USD"),
  terms: z.string().nullable(),
  reputation: z.record(z.string(), z.number()).default({}),
});
export type Supplier = z.infer<typeof Supplier>;

/** Master product data (GS1-oriented). Not priced; source of truth for identifiers. */
export const Product = EntityBase.extend({
  spaceId: Id.nullable().optional(),
  gtin: z.string().nullable(),
  sku: z.string().nullable(),
  manufacturerId: z.string().nullable(),
  name: z.string().min(1),
  description: z.string().default(""),
  dimensions: z.record(z.string(), z.unknown()).nullable().default(null),
  packaging: z.record(z.string(), z.unknown()).nullable().default(null),
  unitOfMeasure: z.string().default("each"),
  taxCategory: z.string().nullable(),
  compliance: z.array(z.string()).default([]),
  lifecycle: z.enum(["draft", "active", "retired"]).default("draft"),
});
export type Product = z.infer<typeof Product>;

export const ProductVariant = EntityBase.extend({
  productId: Id,
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type ProductVariant = z.infer<typeof ProductVariant>;

/** Published, versioned catalogue slice owned by a selling organization. */
export const Catalog = EntityBase.extend({
  ownerOrganizationId: Id,
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  visibility: z.enum(["public", "private"]).default("private"),
  source: z.enum(["native", "mcp", "erp"]).default("native"),
  sourceOfTruth: z.enum(["server", "local", "merge"]).default("server"),
  syncRef: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});
export type Catalog = z.infer<typeof Catalog>;

/** Commercial price / availability line (Peppol-style catalog line + offer). */
export const PriceTier = z.object({
  currency: z.string().min(1),
  minQty: z.number().int().min(0),
  amount: z.number().positive(),
});
export type PriceTier = z.infer<typeof PriceTier>;

export const CatalogOffer = EntityBase.extend({
  catalogId: Id,
  productId: Id,
  sellerOrganizationId: Id,
  spaceId: Id.nullable().optional(),
  orderableUnit: z.string().default("each"),
  priceQuantity: z.number().int().min(1).default(1),
  priceTiers: z.array(PriceTier).min(1),
  minQty: z.number().int().min(0).default(0),
  maxQty: z.number().int().min(0).nullable().default(null),
  orderIncrement: z.number().int().min(1).default(1),
  availability: z.string().nullable(),
  leadTime: z.string().nullable(),
  validityFrom: z.string().nullable(),
  validityTo: z.string().nullable(),
  taxIncluded: z.boolean().default(false),
  status: z.enum(["active", "inactive", "expired"]).default("active"),
});
export type CatalogOffer = z.infer<typeof CatalogOffer>;

/** Buyer-scoped commercial overrides on a catalog offer. */
export const BuyerAgreement = EntityBase.extend({
  catalogOfferId: Id,
  buyerOrganizationId: Id,
  priceTiers: z.array(PriceTier).min(1),
  validityFrom: z.string().nullable(),
  validityTo: z.string().nullable(),
});
export type BuyerAgreement = z.infer<typeof BuyerAgreement>;

export const QuoteRequestItem = z.object({
  productId: Id,
  productName: z.string(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().default("each"),
  requestedUnitPrice: z.number().positive().nullable(),
});
export type QuoteRequestItem = z.infer<typeof QuoteRequestItem>;

export const QuoteRequest = EntityBase.extend({
  buyerOrganizationId: Id,
  spaceId: Id.nullable().optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  items: z.array(QuoteRequestItem).min(1),
  status: z.enum(["open", "quoted", "accepted", "cancelled", "expired"]).default("open"),
  responseDeadline: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteItem = z.object({
  productId: Id,
  productName: z.string(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().default("each"),
  unitPrice: z.number().positive(),
  lineTotal: z.number().positive(),
});
export type QuoteItem = z.infer<typeof QuoteItem>;

export const Quote = EntityBase.extend({
  quoteRequestId: Id,
  sellerOrganizationId: Id,
  spaceId: Id.nullable().optional(),
  items: z.array(QuoteItem).min(1),
  total: z.number().positive(),
  currency: z.string().default("USD"),
  terms: z.string().nullable(),
  status: z.enum(["submitted", "accepted", "rejected", "withdrawn"]).default("submitted"),
  /** Negotiation transcript (A2A / human) attached to the RFQ->Quote exchange. */
  transcript: z.array(z.string()).default([]),
  validUntil: z.string().nullable(),
});
export type Quote = z.infer<typeof Quote>;

export const PurchaseOrderItem = z.object({
  productId: Id,
  productName: z.string(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().default("each"),
  unitPrice: z.number().positive(),
  lineTotal: z.number().positive(),
});
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItem>;

export const PurchaseOrder = EntityBase.extend({
  quoteId: Id,
  buyerOrganizationId: Id,
  sellerOrganizationId: Id,
  spaceId: Id.nullable().optional(),
  items: z.array(PurchaseOrderItem).min(1),
  total: z.number().positive(),
  currency: z.string().default("USD"),
  status: z
    .enum(["draft", "pending_approval", "approved", "fulfilled", "cancelled"])
    .default("pending_approval"),
  approvedByActorId: Id.nullable().default(null),
  paymentIntentId: Id.nullable().default(null),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrder>;