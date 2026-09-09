import type {
  BuyerAgreement,
  Catalog,
  CatalogOffer,
  PaymentIntent,
  PriceTier,
  Product,
  PurchaseOrder,
  Quote,
  QuoteRequest,
  Supplier,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";

export interface RegisterSupplierInput {
  organizationId?: string | null;
  terms?: string | null;
}

export interface CreateCatalogInput {
  name: string;
  version?: string;
  visibility?: Catalog["visibility"];
  source?: Catalog["source"];
  sourceOfTruth?: Catalog["sourceOfTruth"];
  syncRef?: string | null;
}

export interface CreateCatalogOfferInput {
  productId: string;
  orderableUnit?: string;
  priceQuantity?: number;
  priceTiers: PriceTier[];
  minQty?: number;
  maxQty?: number | null;
  orderIncrement?: number;
  availability?: string | null;
  leadTime?: string | null;
  validityFrom?: string | null;
  validityTo?: string | null;
  taxIncluded?: boolean;
}

export interface CreateQuoteRequestInput {
  title: string;
  description?: string;
  items: QuoteRequest["items"];
  responseDeadline?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SubmitQuoteInput {
  items: Quote["items"];
  total: number;
  currency?: string;
  terms?: string | null;
  validUntil?: string | null;
  transcript?: string[];
}

export interface NetworkSearchHit {
  offerId: string;
  productId: string;
  productName: string;
  sellerOrganizationId: string;
  catalogId: string;
  currency: string;
  unitPrice: number;
  priceQuantity: number;
  minQty: number;
  orderIncrement: number;
  leadTime: string | null;
  availability: string | null;
  reputation: number;
  matchScore: number;
}

/**
 * Commerce orchestration: supplier role lifecycle, catalog/product/offer
 * layering, procurement (RFQ -> Quote -> PO) and supplier discovery. All
 * persistence goes through the repository; state transitions and pricing are
 * enforced here.
 */
export interface CommerceService {
  // suppliers
  registerSupplier(actorId: string, input: RegisterSupplierInput): Promise<Supplier>;
  getSupplierByActor(actorId: string): Promise<Supplier | null>;
  listSuppliers(): Promise<Supplier[]>;
  updateSupplier(
    id: string,
    patch: Partial<Pick<Supplier, "organizationId" | "onboardingStatus" | "defaultCurrency" | "terms">>,
  ): Promise<Supplier | null>;

  // products
  createProduct(input: {
    name: string;
    gtin?: string | null;
    sku?: string | null;
    manufacturerId?: string | null;
    unitOfMeasure?: string;
    description?: string;
  }): Promise<Product>;
  listProducts(filter?: { spaceId?: string }): Promise<Product[]>;

  // catalogs
  createCatalog(ownerOrganizationId: string, input: CreateCatalogInput): Promise<Catalog>;
  listCatalogs(ownerOrganizationId?: string): Promise<Catalog[]>;
  publishCatalog(catalogId: string): Promise<Catalog | null>;

  // catalog offers
  createCatalogOffer(
    catalogId: string,
    sellerOrganizationId: string,
    input: CreateCatalogOfferInput,
  ): Promise<CatalogOffer>;
  listCatalogOffers(filter?: { catalogId?: string; sellerOrganizationId?: string; spaceId?: string }): Promise<CatalogOffer[]>;
  updateCatalogOffer(
    id: string,
    patch: Partial<Pick<CatalogOffer, "priceTiers" | "minQty" | "maxQty" | "orderIncrement" | "availability" | "leadTime" | "validityFrom" | "validityTo" | "taxIncluded" | "status">>,
  ): Promise<CatalogOffer | null>;

  // buyer agreements
  createBuyerAgreement(input: {
    catalogOfferId: string;
    buyerOrganizationId: string;
    priceTiers: PriceTier[];
  }): Promise<BuyerAgreement>;
  listBuyerAgreements(filter?: { buyerOrganizationId?: string }): Promise<BuyerAgreement[]>;

  // discovery
  searchNetwork(query: { q?: string; minQty?: number; currency?: string }): Promise<NetworkSearchHit[]>;

  // pricing helper
  priceForOffer(offerId: string, quantity: number, buyerOrganizationId?: string): Promise<{ currency: string; unitPrice: number } | null>;

  // procurement
  createQuoteRequest(buyerOrganizationId: string, input: CreateQuoteRequestInput): Promise<QuoteRequest>;
  listQuoteRequests(buyerOrganizationId: string, filter?: { spaceId?: string }): Promise<QuoteRequest[]>;
  submitQuote(quoteRequestId: string, sellerOrganizationId: string, input: SubmitQuoteInput): Promise<Quote>;
  listQuotes(quoteRequestId: string): Promise<Quote[]>;
  acceptQuote(quoteRequestId: string, quoteId: string): Promise<{ request: QuoteRequest; quote: Quote }>;
  cancelQuoteRequest(quoteRequestId: string): Promise<QuoteRequest | null>;
  createPurchaseOrder(quoteId: string, approvedByActorId: string): Promise<PurchaseOrder>;
  approvePurchaseOrder(purchaseOrderId: string, actorId: string): Promise<PurchaseOrder>;
  fulfillPurchaseOrder(purchaseOrderId: string): Promise<PurchaseOrder>;
  listPurchaseOrders(filter?: { buyerOrganizationId?: string; sellerOrganizationId?: string; spaceId?: string }): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | null>;

  // reputation signal
  recordOutcome(purchaseOrderId: string): Promise<void>;
}

export interface CommerceServiceOptions {
  repo: JamotRepository;
  /** Creates a payment intent once a purchase order is approved. */
  createPaymentIntentForOrder?: (po: PurchaseOrder) => Promise<PaymentIntent>;
  /** Escalation threshold for automatic human-approval gating (HIGH risk). */
  approvalThreshold?: number;
}

export function supplierReputation(supplier: Supplier | null): number {
  if (!supplier) return 0;
  const values = Object.values(supplier.reputation);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function unitPriceForTiers(tiers: PriceTier[], quantity: number, currency?: string): PriceTier | null {
  let best: PriceTier | null = null;
  for (const tier of tiers) {
    if (currency && tier.currency !== currency) continue;
    if (tier.minQty > quantity) continue;
    if (!best || tier.minQty > best.minQty) best = tier;
  }
  return best;
}

export function applyQuantityConstraints(
  offer: CatalogOffer | null,
  quantity: number,
): boolean {
  if (!offer || offer.status !== "active") return false;
  if (offer.minQty > 0 && quantity < offer.minQty) return false;
  if (offer.maxQty != null && quantity > offer.maxQty) return false;
  if (offer.orderIncrement > 1 && (quantity - Math.max(offer.minQty, 0)) % offer.orderIncrement !== 0) {
    return false;
  }
  if (offer.validityFrom && new Date(offer.validityFrom).getTime() > Date.now()) return false;
  if (offer.validityTo && new Date(offer.validityTo).getTime() < Date.now()) return false;
  return true;
}