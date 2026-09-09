import { describe, expect, it, beforeAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

const BUYER_ORG = "00000000-0000-4000-8000-000000000001";
const SELLER_ORG = "00000000-0000-4000-8000-000000000002";
const SELLER_ACTOR = "00000000-0000-4000-8000-000000000003";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000004";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

describe("commerce + payments routes smoke", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie: string;
  let offerId: string;
  let catalogId: string;
  let qrId: string;
  let quoteId: string;
  let purchaseOrderId: string;
  let paymentIntentId: string;

  beforeAll(async () => {
    app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "trader@example.com", password: "password123", displayName: "Trader" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "trader@example.com", password: "password123" },
    });
    cookie = sessionCookie(login);
  });

  it("registers a supplier", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suppliers",
      headers: { cookie },
      payload: {
        actorId: SELLER_ACTOR,
        organizationId: SELLER_ORG,
        terms: "net 30",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().actorId).toBe(SELLER_ACTOR);

    const lookup = await app.inject({
      method: "GET",
      url: `/api/suppliers/by-actor/${SELLER_ACTOR}`,
      headers: { cookie },
    });
    expect(lookup.statusCode).toBe(200);
  });

  it("creates a product, catalog, and published offer", async () => {
    const product = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: { cookie },
      payload: { name: "Ball Bearings", sku: "BB-9000", gtin: "08400050119000", unitOfMeasure: "each" },
    });
    expect(product.statusCode).toBe(201);

    const catalog = await app.inject({
      method: "POST",
      url: "/api/catalogs",
      headers: { cookie },
      payload: {
        ownerOrganizationId: SELLER_ORG,
        name: "Trader Catalogue",
        visibility: "public",
      },
    });
    expect(catalog.statusCode).toBe(201);
    catalogId = catalog.json().id;

    const published = await app.inject({
      method: "POST",
      url: `/api/catalogs/${catalogId}/publish`,
      headers: { cookie },
    });
    expect(published.statusCode).toBe(200);

    const offer = await app.inject({
      method: "POST",
      url: "/api/catalog-offers",
      headers: { cookie },
      payload: {
        catalogId,
        sellerOrganizationId: SELLER_ORG,
        productId: product.json().id,
        priceTiers: [{ minQty: 1, amount: 850, currency: "USD" }],
      },
    });
    expect(offer.statusCode).toBe(201);
    offerId = offer.json().id;
  });

  it("finds the offer via network search and prices it", async () => {
    const search = await app.inject({
      method: "GET",
      url: `/api/network/search?q=${encodeURIComponent("bearings")}`,
      headers: { cookie },
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().items.length).toBeGreaterThan(0);
    expect(search.json().items[0].offerId).toBe(offerId);

    const pricing = await app.inject({
      method: "GET",
      url: `/api/pricing/${offerId}?quantity=2`,
      headers: { cookie },
    });
    expect(pricing.statusCode).toBe(200);
    expect(pricing.json().unitPrice).toBe(850);
  });

  it("runs an RFQ -> Quote -> PO flow and gates the high-value PO behind approval", async () => {
    const rq = await app.inject({
      method: "POST",
      url: "/api/quote-requests",
      headers: { cookie },
      payload: {
        buyerOrganizationId: BUYER_ORG,
        title: "Need bearings",
        items: [
          {
            productId: PRODUCT_ID,
            productName: "Ball Bearings",
            quantity: 2,
            unitOfMeasure: "each",
            requestedUnitPrice: null,
          },
        ],
      },
    });
    expect(rq.statusCode).toBe(201);
    qrId = rq.json().id;

    const quote = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: { cookie },
      payload: {
        quoteRequestId: qrId,
        sellerOrganizationId: SELLER_ORG,
        items: [
          {
            productId: PRODUCT_ID,
            productName: "Ball Bearings",
            quantity: 2,
            unitOfMeasure: "each",
            unitPrice: 850,
            lineTotal: 1700,
          },
        ],
        total: 1700,
        currency: "USD",
      },
    });
    expect(quote.statusCode).toBe(201);
    quoteId = quote.json().id;

    const accepted = await app.inject({
      method: "POST",
      url: `/api/quote-requests/${qrId}/accept`,
      headers: { cookie },
      payload: { quoteId },
    });
    expect(accepted.statusCode).toBe(200);

    const po = await app.inject({
      method: "POST",
      url: "/api/purchase-orders",
      headers: { cookie },
      payload: { quoteId },
    });
    expect(po.statusCode).toBe(201);
    expect(po.json().status).toBe("pending_approval");
    purchaseOrderId = po.json().id;

    const approved = await app.inject({
      method: "POST",
      url: `/api/purchase-orders/${purchaseOrderId}/approve`,
      headers: { cookie },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");
    expect(approved.json().paymentIntentId).toBeTruthy();
  });

  it("lists, approves, confirms, and records a payment intent", async () => {
    const list = await app.inject({
      method: "GET",
      url: `/api/payment-intents`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const intents = list.json().items as Array<{ id: string; status: string }>;
    expect(intents.length).toBeGreaterThan(0);
    paymentIntentId = intents[0]!.id;
    expect(intents[0]!.status).toBe("approved");

    const confirmed = await app.inject({
      method: "POST",
      url: `/api/payment-intents/${paymentIntentId}/confirm`,
      headers: { cookie },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().status).toBe("paid");
    expect(confirmed.json().providerReference).toBeTruthy();

    const records = await app.inject({
      method: "GET",
      url: `/api/payment-intents/${paymentIntentId}/records`,
      headers: { cookie },
    });
    expect(records.statusCode).toBe(200);
    expect(records.json().items).toHaveLength(1);
    expect(records.json().items[0].paidAmount).toBe(1700);
  });
});