import { describe, expect, it } from "vitest";
import { Id } from "@jamot/contracts";
import { createMemoryRepository } from "../repository/memory.js";
import { createCommerceService } from "./service.js";

const ORG_BUYER = "00000000-0000-4000-8000-000000000001";
const ORG_SELLER = "00000000-0000-4000-8000-000000000002";
const ACTOR_SELLER = "00000000-0000-4000-8000-000000000003";
const ACTOR_BUYER = "00000000-0000-4000-8000-000000000004";
const PROD = "00000000-0000-4000-8000-000000000005";

function rqItems(quantity = 1, requestedUnitPrice: number | null = null) {
  return [
    {
      productId: Id.parse(PROD),
      productName: "Steel Beam",
      quantity,
      unitOfMeasure: "each",
      requestedUnitPrice,
    },
  ];
}
function quoteItems(quantity = 1, unitPrice = 10) {
  return [
    {
      productId: Id.parse(PROD),
      productName: "Steel Beam",
      quantity,
      unitOfMeasure: "each",
      unitPrice,
      lineTotal: quantity * unitPrice,
    },
  ];
}

async function seedOffer(
  repo: ReturnType<typeof createMemoryRepository>,
): Promise<string> {
  const product = await repo.createProduct({
    name: "Steel Beam",
    gtin: "08400050118800",
    sku: "SB-100",
    manufacturerId: null,
    unitOfMeasure: "each",
    description: "",
  });
  const catalog = await repo.createCatalog({
    ownerOrganizationId: ORG_SELLER,
    name: "Seller Catalog",
    version: "1.0.0",
    visibility: "public",
    source: "native",
    sourceOfTruth: "server",
    syncRef: null,
  });
  await repo.updateCatalog(catalog.id, { status: "published" });
  const offer = await repo.createCatalogOffer({
    catalogId: catalog.id,
    sellerOrganizationId: ORG_SELLER,
    productId: product.id,
    orderableUnit: "each",
    priceQuantity: 1,
    priceTiers: [{ minQty: 1, amount: 10, currency: "USD" }],
    minQty: 1,
    maxQty: null,
    orderIncrement: 1,
    availability: null,
    leadTime: null,
    validityFrom: null,
    validityTo: null,
    taxIncluded: false,
  });
  return offer.id;
}

describe("commerce service", () => {
  it("registers a supplier idempotently by actor", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    const first = await svc.registerSupplier(ACTOR_SELLER, { organizationId: ORG_SELLER });
    const second = await svc.registerSupplier(ACTOR_SELLER, { organizationId: ORG_SELLER });
    expect(second.id).toBe(first.id);
    expect(await svc.getSupplierByActor(ACTOR_SELLER)).toEqual(first);
  });

  it("searches the network for published offers ranked by reputation", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    await seedOffer(repo);
    const hits = await svc.searchNetwork({ q: "steel" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.productName).toBe("Steel Beam");
    expect(hits[0]?.currency).toBe("USD");
    expect(hits[0]?.unitPrice).toBe(10);
    expect(hits[0]?.reputation).toBe(0);
  });

  it("does not surface private or unpublished catalogs", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    await seedOffer(repo);
    const offers = await repo.listCatalogOffers();
    const offer = offers[0]!;
    const catalog = await repo.getCatalog(offer.catalogId);
    await repo.updateCatalog(catalog!.id, { status: "draft", visibility: "private" });
    expect(await svc.searchNetwork({ q: "steel" })).toHaveLength(0);
  });

  it("applies buyer agreement price tiers to pricing", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    const offerId = await seedOffer(repo);
    await svc.createBuyerAgreement({
      catalogOfferId: offerId,
      buyerOrganizationId: ORG_BUYER,
      priceTiers: [{ minQty: 1, amount: 7, currency: "USD" }],
    });
    const agreed = await svc.priceForOffer(offerId, 1, ORG_BUYER);
    expect(agreed?.unitPrice).toBe(7);
    const list = await svc.priceForOffer(offerId, 1);
    expect(list?.unitPrice).toBe(10);
  });

  it("accepting a quote then creating a PO gates on low value with direct approval", async () => {
    const repo = createMemoryRepository();
    let intentCreated = false;
    const svc = createCommerceService({
      repo,
      approvalThreshold: 1000,
      createPaymentIntentForOrder: async (po) => {
        intentCreated = true;
        return repo.createPaymentIntent({
          purchaseOrderId: po.id,
          buyerOrganizationId: po.buyerOrganizationId,
          sellerOrganizationId: po.sellerOrganizationId,
          currency: po.currency,
          estimatedAmount: po.total,
          provider: "ledger",
          requiresApproval: false,
          approvedByActorId: null,
          metadata: { source: "purchase_order" },
          status: "approved",
        });
      },
    });

    const qr = await svc.createQuoteRequest(ORG_BUYER, {
      title: "Need steel",
      items: rqItems(),
    });
    const quote = await svc.submitQuote(qr.id, ORG_SELLER, {
      items: quoteItems(),
      total: 10,
      currency: "USD",
    });
    await svc.acceptQuote(qr.id, quote.id);

    const po = await svc.createPurchaseOrder(quote.id, ACTOR_BUYER);
    expect(po.status).toBe("approved");
    expect(po.approvedByActorId).toBe(ACTOR_BUYER);
    expect(po.paymentIntentId).toBeTruthy();
    expect(po.paymentIntentId).not.toBeNull();
    expect(intentCreated).toBe(true);
  });

  it("gates high-value POs behind pending_approval and requires explicit approval", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo, approvalThreshold: 50 });

    const qr = await svc.createQuoteRequest(ORG_BUYER, {
      title: "Bulk order",
      items: rqItems(20),
    });
    const quote = await svc.submitQuote(qr.id, ORG_SELLER, {
      items: quoteItems(20, 5),
      total: 100,
      currency: "USD",
    });
    await svc.acceptQuote(qr.id, quote.id);

    const po = await svc.createPurchaseOrder(quote.id, ACTOR_BUYER);
    expect(po.status).toBe("pending_approval");
    expect(po.approvedByActorId).toBeNull();

    await expect(svc.fulfillPurchaseOrder(po.id)).rejects.toThrow("state pending_approval");
    const approved = await svc.approvePurchaseOrder(po.id, ACTOR_BUYER);
    expect(approved.status).toBe("approved");
    expect(approved.approvedByActorId).toBe(ACTOR_BUYER);
  });

  it("cannot create a PO from a non-accepted quote", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    const qr = await svc.createQuoteRequest(ORG_BUYER, {
      title: "Never accepted",
      items: rqItems(),
    });
    const quote = await svc.submitQuote(qr.id, ORG_SELLER, {
      items: quoteItems(),
      total: 10,
    });
    await expect(svc.createPurchaseOrder(quote.id, ACTOR_BUYER)).rejects.toThrow(
      "quote must be accepted",
    );
  });

  it("records fulfilled outcome into supplier procurement reputation", async () => {
    const repo = createMemoryRepository();
    const svc = createCommerceService({ repo });
    await svc.registerSupplier(ACTOR_SELLER, { organizationId: ORG_SELLER });

    const qr = await svc.createQuoteRequest(ORG_BUYER, { title: "t", items: rqItems() });
    const quote = await svc.submitQuote(qr.id, ORG_SELLER, { items: quoteItems(), total: 1 });
    await svc.acceptQuote(qr.id, quote.id);
    const po = await svc.createPurchaseOrder(quote.id, ACTOR_BUYER);
    await svc.fulfillPurchaseOrder(po.id);

    await svc.recordOutcome(po.id);
    const supplier = await svc.getSupplierByActor(ACTOR_SELLER);
    expect(supplier?.reputation.procurement).toBe(100);
    expect(supplier?.reputation["procurement.outcomes"]).toBe(1);
  });
});