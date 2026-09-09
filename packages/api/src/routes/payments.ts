import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { PaymentProviderKind } from "@jamot/contracts";
import type { PaymentService } from "@jamot/core/payments";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface PaymentsRoutesOptions {
  payments: PaymentService;
}

const CreateIntentBody = z.object({
  purchaseOrderId: Id,
  buyerOrganizationId: Id,
  sellerOrganizationId: Id,
  estimatedAmount: z.number().positive(),
  currency: z.string().optional(),
  provider: z.enum(["ledger", "card", "bank", "stablecoin"] as const).optional(),
  requiresApproval: z.boolean().optional(),
  approvedByActorId: Id.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export default async function paymentsRoutes(
  app: FastifyInstance,
  opts: PaymentsRoutesOptions,
): Promise<void> {
  const { payments } = opts;

  app.post("/payment-intents", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateIntentBody, request.body, reply);
    if (!body) return;
    const intent = await payments.createIntent({
      ...body,
      metadata: body.metadata ?? null,
    });
    reply.code(201);
    return intent;
  });

  app.get("/payment-intents", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { organizationId?: string; role?: "buyer" | "seller"; spaceId?: string };
    if (query.organizationId && (query.role === "buyer" || query.role === "seller")) {
      return { items: await payments.listByOrganization(query.organizationId, query.role, query.spaceId) };
    }
    return { items: await payments.listAll(query.spaceId) };
  });

  app.get("/payment-intents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const intent = await payments.get(id);
    if (!intent) return fail(reply, 404, "payment intent not found");
    return intent;
  });

  app.post(
    "/payment-intents/:id/approve",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await payments.approveIntent(id, request.session.actorId!);
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot approve intent");
      }
    },
  );

  app.post(
    "/payment-intents/:id/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await payments.confirmPayment(id, request.session.actorId!);
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot confirm intent");
      }
    },
  );

  app.post(
    "/payment-intents/:id/cancel",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await payments.cancelIntent(id);
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot cancel intent");
      }
    },
  );

  app.post(
    "/payment-intents/:id/refund",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await payments.refund(id);
      } catch (err) {
        return fail(reply, 409, err instanceof Error ? err.message : "cannot refund intent");
      }
    },
  );

  app.get("/payment-intents/:id/records", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    return { items: await payments.listRecords(id) };
  });
}