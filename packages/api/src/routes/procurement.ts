import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id, QuoteRequestItem, QuoteItem } from "@jamot/contracts";
import type { CommerceService } from "@jamot/core/commerce";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface ProcurementRoutesOptions {
  commerce: CommerceService;
}

const CreateQuoteRequestBody = z.object({
  buyerOrganizationId: Id,
  title: z.string().min(1),
  description: z.string().optional(),
  items: z.array(QuoteRequestItem).min(1),
  responseDeadline: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const SubmitQuoteBody = z.object({
  sellerOrganizationId: Id,
  items: z.array(QuoteItem).min(1),
  total: z.number().positive(),
  currency: z.string().optional(),
  terms: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  transcript: z.array(z.string()).optional(),
});

export default async function procurementRoutes(
  app: FastifyInstance,
  opts: ProcurementRoutesOptions,
): Promise<void> {
  const { commerce } = opts;

  // RFQ
  app.post("/quote-requests", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateQuoteRequestBody, request.body, reply);
    if (!body) return;
    const qr = await commerce.createQuoteRequest(body.buyerOrganizationId, body);
    reply.code(201);
    return qr;
  });

  app.get("/quote-requests", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { buyerOrganizationId?: string; spaceId?: string };
    if (!query.buyerOrganizationId) return fail(reply, 400, "buyerOrganizationId is required");
    return { items: await commerce.listQuoteRequests(query.buyerOrganizationId, { spaceId: query.spaceId }) };
  });

  app.post(
    "/quote-requests/:id/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = request.body as { quoteId?: string };
      const quoteId = parse(Id, body.quoteId, reply);
      if (!quoteId) return;
      try {
        return await commerce.acceptQuote(id, quoteId);
      } catch {
        return fail(reply, 409, "cannot accept quote");
      }
    },
  );

  app.post(
    "/quote-requests/:id/cancel",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const qr = await commerce.cancelQuoteRequest(id);
      if (!qr) return fail(reply, 404, "quote request not found");
      return qr;
    },
  );

  // quotes
  app.post("/quotes", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { quoteRequestId?: string };
    const rawBody = request.body as Record<string, unknown> & { quoteRequestId?: string };
    const quoteRequestId = parse(Id, rawBody.quoteRequestId ?? params.quoteRequestId ?? undefined, reply);
    if (!quoteRequestId) return;
    const body = parse(SubmitQuoteBody, request.body, reply);
    if (!body) return;
    try {
      const quote = await commerce.submitQuote(
        quoteRequestId,
        body.sellerOrganizationId,
        body,
      );
      reply.code(201);
      return quote;
    } catch (err) {
      return fail(reply, 409, err instanceof Error ? err.message : "cannot submit quote");
    }
  });

  app.get("/quotes", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { quoteRequestId?: string };
    if (!query.quoteRequestId) return fail(reply, 400, "quoteRequestId is required");
    return { items: await commerce.listQuotes(query.quoteRequestId) };
  });

  // purchase orders
  app.post("/purchase-orders", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(
      z.object({ quoteId: Id, approvedByActorId: Id.optional() }),
      request.body,
      reply,
    );
    if (!body) return;
    try {
      const po = await commerce.createPurchaseOrder(
        body.quoteId,
        body.approvedByActorId ?? request.session.actorId!,
      );
      reply.code(201);
      return po;
    } catch (err) {
      return fail(reply, 409, err instanceof Error ? err.message : "cannot create purchase order");
    }
  });

  app.get("/purchase-orders", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { buyerOrganizationId?: string; sellerOrganizationId?: string; spaceId?: string };
    return { items: await commerce.listPurchaseOrders(query) };
  });

  app.get("/purchase-orders/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const po = await commerce.getPurchaseOrder(id);
    if (!po) return fail(reply, 404, "purchase order not found");
    return po;
  });

  app.post(
    "/purchase-orders/:id/approve",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await commerce.approvePurchaseOrder(id, request.session.actorId!);
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot approve purchase order");
      }
    },
  );

  app.post(
    "/purchase-orders/:id/fulfill",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        const po = await commerce.fulfillPurchaseOrder(id);
        await commerce.recordOutcome(id);
        return po;
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot fulfill purchase order");
      }
    },
  );
}