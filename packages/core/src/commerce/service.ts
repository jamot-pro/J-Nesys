import type { Catalog, CatalogOffer, PurchaseOrder } from "@jamot/contracts";
import type {
  CommerceService,
  CommerceServiceOptions,
  NetworkSearchHit,
  RegisterSupplierInput,
} from "./commerce.js";
import {
  applyQuantityConstraints,
  supplierReputation,
  unitPriceForTiers,
} from "./commerce.js";

export function createCommerceService(opts: CommerceServiceOptions): CommerceService {
  const { repo, createPaymentIntentForOrder, approvalThreshold = 1000 } = opts;

  async function effectiveTiers(offer: CatalogOffer | null, buyerOrganizationId?: string) {
    if (!offer) return null;
    if (buyerOrganizationId) {
      const agreements = await repo.listBuyerAgreements({
        catalogOfferId: offer.id,
        buyerOrganizationId,
      });
      const now = Date.now();
      const active = agreements.find((a) => {
        if (a.validityFrom && new Date(a.validityFrom).getTime() > now) return false;
        if (a.validityTo && new Date(a.validityTo).getTime() < now) return false;
        return true;
      });
      if (active) return active.priceTiers;
    }
    return offer.priceTiers;
  }

  return {
    async registerSupplier(actorId: string, input: RegisterSupplierInput) {
      const existing = await repo.getSupplierByActor(actorId);
      if (existing) return existing;
      return repo.createSupplier({
        actorId,
        organizationId: input.organizationId ?? null,
        terms: input.terms ?? null,
      });
    },

    async getSupplierByActor(actorId) {
      return repo.getSupplierByActor(actorId);
    },

    async listSuppliers() {
      return repo.listSuppliers();
    },

    async updateSupplier(id, patch) {
      return repo.updateSupplier(id, patch);
    },

    async createProduct(input) {
      return repo.createProduct(input);
    },

    async listProducts(filter) {
      return repo.listProducts(filter);
    },

    async createCatalog(ownerOrganizationId, input) {
      return repo.createCatalog({
        ownerOrganizationId,
        name: input.name,
        version: input.version ?? "1.0.0",
        visibility: input.visibility ?? "private",
        source: input.source ?? "native",
        sourceOfTruth: input.sourceOfTruth ?? "server",
        syncRef: input.syncRef ?? null,
      });
    },

    async listCatalogs(ownerOrganizationId) {
      return repo.listCatalogs(ownerOrganizationId ? { ownerOrganizationId } : undefined);
    },

    async publishCatalog(catalogId) {
      const catalog = await repo.getCatalog(catalogId);
      if (!catalog) return null;
      return repo.updateCatalog(catalogId, { status: "published", version: bumpVersion(catalog.version) });
    },

    async createCatalogOffer(catalogId, sellerOrganizationId, input) {
      return repo.createCatalogOffer({
        catalogId,
        sellerOrganizationId,
        productId: input.productId,
        orderableUnit: input.orderableUnit,
        priceQuantity: input.priceQuantity,
        priceTiers: input.priceTiers,
        minQty: input.minQty,
        maxQty: input.maxQty,
        orderIncrement: input.orderIncrement,
        availability: input.availability,
        leadTime: input.leadTime,
        validityFrom: input.validityFrom,
        validityTo: input.validityTo,
        taxIncluded: input.taxIncluded,
      });
    },

    async listCatalogOffers(filter) {
      return repo.listCatalogOffers(filter);
    },

    async updateCatalogOffer(id, patch) {
      return repo.updateCatalogOffer(id, patch);
    },

    async createBuyerAgreement(input) {
      return repo.createBuyerAgreement(input);
    },

    async listBuyerAgreements(filter) {
      return repo.listBuyerAgreements(filter);
    },

    async priceForOffer(offerId, quantity, buyerOrganizationId) {
      const offer = await repo.getCatalogOffer(offerId);
      if (!applyQuantityConstraints(offer, quantity)) return null;
      const tiers = await effectiveTiers(offer, buyerOrganizationId);
      if (!tiers || tiers.length === 0) return null;
      const tier = unitPriceForTiers(tiers, quantity);
      if (!tier) return null;
      return { currency: tier.currency, unitPrice: tier.amount };
    },

    async searchNetwork(query) {
      const offers = await repo.listCatalogOffers();
      const now = Date.now();
      const hits: NetworkSearchHit[] = [];

      for (const offer of offers) {
        if (!applyQuantityConstraints(offer, query.minQty ?? 1)) continue;
        const catalog = await repo.getCatalog(offer.catalogId);
        if (!catalog || catalog.status !== "published") continue;
        if (catalog.visibility === "private") continue;
        const product = await repo.getProduct(offer.productId);
        if (!product || product.lifecycle === "retired") continue;
        if (query.q && !`${product.name} ${product.sku ?? ""} ${product.gtin ?? ""}`.toLowerCase().includes(query.q.toLowerCase())) {
          continue;
        }
        const tier = unitPriceForTiers(offer.priceTiers, query.minQty ?? 1, query.currency);
        if (!tier) continue;
        const supplierForOrg = (await repo.listSuppliers({ organizationId: offer.sellerOrganizationId }))[0];
        const reputation = supplierReputation(supplierForOrg ?? null);
        const score = reputation * 0.5 + (query.minQty ? 0.1 : 0);
        hits.push({
          offerId: offer.id,
          productId: offer.productId,
          productName: product.name,
          sellerOrganizationId: offer.sellerOrganizationId,
          catalogId: offer.catalogId,
          currency: tier.currency,
          unitPrice: tier.amount,
          priceQuantity: offer.priceQuantity,
          minQty: offer.minQty,
          orderIncrement: offer.orderIncrement,
          leadTime: offer.leadTime,
          availability: offer.availability,
          reputation,
          matchScore: score,
        });
      }

      return hits.sort((a, b) => b.matchScore - a.matchScore);
    },

    async createQuoteRequest(buyerOrganizationId, input) {
      return repo.createQuoteRequest({
        buyerOrganizationId,
        title: input.title,
        description: input.description ?? "",
        items: input.items,
        responseDeadline: input.responseDeadline ?? null,
        metadata: input.metadata ?? null,
      });
    },

    async listQuoteRequests(buyerOrganizationId, filter) {
      return repo.listQuoteRequests({ buyerOrganizationId, spaceId: filter?.spaceId });
    },

    async submitQuote(quoteRequestId, sellerOrganizationId, input) {
      const request = await repo.getQuoteRequest(quoteRequestId);
      if (!request) throw new Error("quote request not found");
      if (request.status !== "open") throw new Error("quote request is not open");
      return repo.createQuote({
        quoteRequestId,
        sellerOrganizationId,
        items: input.items,
        total: input.total,
        currency: input.currency ?? "USD",
        terms: input.terms ?? null,
        validUntil: input.validUntil ?? null,
        transcript: input.transcript ?? [],
      });
    },

    async listQuotes(quoteRequestId) {
      return repo.listQuotes({ quoteRequestId });
    },

    async acceptQuote(quoteRequestId, quoteId) {
      const request = await repo.getQuoteRequest(quoteRequestId);
      if (!request) throw new Error("quote request not found");
      const quote = await repo.getQuote(quoteId);
      if (!quote) throw new Error("quote not found");
      const updatedRequest = await repo.updateQuoteRequestStatus(quoteRequestId, "accepted");
      const updatedQuote = await repo.updateQuoteStatus(quoteId, "accepted");
      if (!updatedRequest || !updatedQuote) throw new Error("failed to accept quote");
      return { request: updatedRequest, quote: updatedQuote };
    },

    async cancelQuoteRequest(quoteRequestId) {
      return repo.updateQuoteRequestStatus(quoteRequestId, "cancelled");
    },

    async createPurchaseOrder(quoteId, approvedByActorId) {
      const quote = await repo.getQuote(quoteId);
      if (!quote) throw new Error("quote not found");
      if (quote.status !== "accepted") throw new Error("quote must be accepted before ordering");
      const request = await repo.getQuoteRequest(quote.quoteRequestId);
      if (!request) throw new Error("quote request not found");
      const requiresApproval = quote.total >= approvalThreshold;
      let purchaseOrder = await repo.createPurchaseOrder({
        quoteId,
        buyerOrganizationId: request.buyerOrganizationId,
        sellerOrganizationId: quote.sellerOrganizationId,
        items: quote.items,
        total: quote.total,
        currency: quote.currency,
        status: requiresApproval ? "pending_approval" : "approved",
        ...(requiresApproval ? {} : { approvedByActorId }),
      });
      if (!requiresApproval && createPaymentIntentForOrder) {
        const intent = await createPaymentIntentForOrder(purchaseOrder);
        const attached = await repo.updatePurchaseOrder(purchaseOrder.id, { paymentIntentId: intent.id });
        if (attached) purchaseOrder = attached;
      }
      return purchaseOrder;
    },

    async approvePurchaseOrder(purchaseOrderId, actorId) {
      const po = await repo.getPurchaseOrder(purchaseOrderId);
      if (!po) throw new Error("purchase order not found");
      if (po.status !== "pending_approval") throw new Error(`cannot approve purchase order in state ${po.status}`);
      let updated = await repo.updatePurchaseOrder(purchaseOrderId, { status: "approved", approvedByActorId: actorId });
      if (!updated) throw new Error("failed to approve purchase order");
      if (createPaymentIntentForOrder) {
        const intent = await createPaymentIntentForOrder(updated);
        updated = await repo.updatePurchaseOrder(purchaseOrderId, { paymentIntentId: intent.id });
        if (!updated) throw new Error("failed to attach payment intent");
      }
      return updated;
    },

    async fulfillPurchaseOrder(purchaseOrderId) {
      const po = await repo.getPurchaseOrder(purchaseOrderId);
      if (!po) throw new Error("purchase order not found");
      if (po.status !== "approved") throw new Error(`cannot fulfill purchase order in state ${po.status}`);
      const updated = await repo.updatePurchaseOrder(purchaseOrderId, { status: "fulfilled" });
      if (!updated) throw new Error("failed to fulfill purchase order");
      return updated;
    },

    async listPurchaseOrders(filter) {
      return repo.listPurchaseOrders(filter);
    },

    async getPurchaseOrder(id) {
      return repo.getPurchaseOrder(id);
    },

    async recordOutcome(purchaseOrderId) {
      const po = await repo.getPurchaseOrder(purchaseOrderId);
      if (!po) return;
      const supplier = (await repo.listSuppliers({ organizationId: po.sellerOrganizationId }))[0];
      if (!supplier) return;
      const current = supplier.reputation ?? {};
      const capability = "procurement";
      const count = current[`${capability}.outcomes`] ?? 0;
      const base = typeof current[capability] === "number" ? current[capability] : 0;
      const next = base * count / (count + 1) + (po.status === "fulfilled" ? 100 : 40) / (count + 1);
      await repo.updateSupplier(supplier.id, {
        reputation: {
          ...current,
          [capability]: Math.round(next),
          [`${capability}.outcomes`]: count + 1,
        },
      });
    },
  };
}

function bumpVersion(version: string): string {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 0) parts.push(0);
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}