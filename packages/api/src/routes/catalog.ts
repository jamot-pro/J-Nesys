import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id, PriceTier } from "@jamot/contracts";
import type { CommerceService } from "@jamot/core/commerce";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface CatalogRoutesOptions {
  commerce: CommerceService;
}

function coerceQuery<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

const CreateProductBody = z.object({
  name: z.string().min(1),
  gtin: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  manufacturerId: z.string().nullable().optional(),
  unitOfMeasure: z.string().optional(),
  description: z.string().optional(),
});

const CreateCatalogBody = z.object({
  ownerOrganizationId: Id,
  name: z.string().min(1),
  version: z.string().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  source: z.enum(["native", "mcp", "erp"]).optional(),
  sourceOfTruth: z.enum(["server", "local", "merge"]).optional(),
  syncRef: z.string().nullable().optional(),
});

const CreateCatalogOfferBody = z.object({
  catalogId: Id,
  sellerOrganizationId: Id,
  productId: Id,
  orderableUnit: z.string().optional(),
  priceQuantity: z.number().int().min(1).optional(),
  priceTiers: z.array(PriceTier).min(1),
  minQty: z.number().int().min(0).optional(),
  maxQty: z.number().int().min(0).nullable().optional(),
  orderIncrement: z.number().int().min(1).optional(),
  availability: z.string().nullable().optional(),
  leadTime: z.string().nullable().optional(),
  validityFrom: z.string().nullable().optional(),
  validityTo: z.string().nullable().optional(),
  taxIncluded: z.boolean().optional(),
});

const UpdateCatalogOfferBody = z.object({
  priceTiers: z.array(PriceTier).optional(),
  minQty: z.number().int().min(0).optional(),
  maxQty: z.number().int().min(0).nullable().optional(),
  orderIncrement: z.number().int().min(1).optional(),
  availability: z.string().nullable().optional(),
  leadTime: z.string().nullable().optional(),
  validityFrom: z.string().nullable().optional(),
  validityTo: z.string().nullable().optional(),
  taxIncluded: z.boolean().optional(),
  status: z.enum(["active", "inactive", "expired"]).optional(),
});

const CreateBuyerAgreementBody = z.object({
  catalogOfferId: Id,
  buyerOrganizationId: Id,
  priceTiers: z.array(PriceTier).min(1),
});

const NetworkSearchQuery = z.object({
  q: z.string().optional(),
  minQty: z.coerce.number().int().min(1).optional(),
  currency: z.string().optional(),
});

export default async function catalogRoutes(
  app: FastifyInstance,
  opts: CatalogRoutesOptions,
): Promise<void> {
  const { commerce } = opts;

  // products (master data)
  app.post("/products", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateProductBody, request.body, reply);
    if (!body) return;
    const product = await commerce.createProduct(body);
    reply.code(201);
    return product;
  });

  app.get("/products", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { spaceId?: string };
    return {
      items: await commerce.listProducts(query.spaceId ? { spaceId: query.spaceId } : undefined),
    };
  });

  // catalogs
  app.post("/catalogs", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateCatalogBody, request.body, reply);
    if (!body) return;
    const catalog = await commerce.createCatalog(body.ownerOrganizationId, body);
    reply.code(201);
    return catalog;
  });

  app.get("/catalogs", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { ownerOrganizationId?: string };
    const parsed = query.ownerOrganizationId && Id.safeParse(query.ownerOrganizationId).success
      ? query.ownerOrganizationId
      : undefined;
    return { items: await commerce.listCatalogs(parsed) };
  });

  app.post(
    "/catalogs/:id/publish",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const catalog = await commerce.publishCatalog(id);
      if (!catalog) return fail(reply, 404, "catalog not found");
      return catalog;
    },
  );

  // catalog offers
  app.post("/catalog-offers", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateCatalogOfferBody, request.body, reply);
    if (!body) return;
    const offer = await commerce.createCatalogOffer(
      body.catalogId,
      body.sellerOrganizationId,
      body,
    );
    reply.code(201);
    return offer;
  });

  app.get("/catalog-offers", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { catalogId?: string; sellerOrganizationId?: string; spaceId?: string };
    return {
      items: await commerce.listCatalogOffers({
        catalogId: query.catalogId,
        sellerOrganizationId: query.sellerOrganizationId,
        spaceId: query.spaceId,
      }),
    };
  });

  app.patch("/catalog-offers/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateCatalogOfferBody, request.body, reply);
    if (!body) return;
    const offer = await commerce.updateCatalogOffer(id, body);
    if (!offer) return fail(reply, 404, "catalog offer not found");
    return offer;
  });

  // pricing helper
  app.get("/pricing/:offerId", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { offerId?: string };
    const offerId = parse(Id, params.offerId, reply);
    if (!offerId) return;
    const query = request.query as { quantity?: string; buyerOrganizationId?: string };
    const quantity = Number(query.quantity ?? "1");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return fail(reply, 400, "quantity must be a positive number");
    }
    const price = await commerce.priceForOffer(
      offerId,
      quantity,
      query.buyerOrganizationId,
    );
    if (!price) return fail(reply, 404, "offer not purchasable at this quantity");
    return price;
  });

  // buyer agreements
  app.post("/buyer-agreements", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateBuyerAgreementBody, request.body, reply);
    if (!body) return;
    const agreement = await commerce.createBuyerAgreement(body);
    reply.code(201);
    return agreement;
  });

  app.get("/buyer-agreements", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { buyerOrganizationId?: string };
    return { items: await commerce.listBuyerAgreements(query) };
  });

  // discovery
  app.get("/network/search", { preHandler: requireAuth }, async (request, reply) => {
    const query = coerceQuery(NetworkSearchQuery, request.query);
    if (!query) {
      return fail(reply, 400, "invalid search query");
    }
    return { items: await commerce.searchNetwork(query) };
  });
}