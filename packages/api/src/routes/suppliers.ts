import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { CommerceService } from "@jamot/core/commerce";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface SuppliersRoutesOptions {
  commerce: CommerceService;
}

const RegisterSupplierBody = z.object({
  actorId: Id,
  organizationId: Id.nullable().optional(),
  terms: z.string().nullable().optional(),
});

const UpdateSupplierBody = z.object({
  organizationId: Id.nullable().optional(),
  onboardingStatus: z.enum(["invited", "active", "suspended"]).optional(),
  defaultCurrency: z.string().optional(),
  terms: z.string().nullable().optional(),
});

export default async function suppliersRoutes(
  app: FastifyInstance,
  opts: SuppliersRoutesOptions,
): Promise<void> {
  const { commerce } = opts;

  app.post(
    "/suppliers",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parse(RegisterSupplierBody, request.body, reply);
      if (!body) return;
      const supplier = await commerce.registerSupplier(body.actorId, {
        organizationId: body.organizationId,
        terms: body.terms,
      });
      reply.code(201);
      return supplier;
    },
  );

  app.get("/suppliers", { preHandler: requireAuth }, async () => ({
    items: await commerce.listSuppliers(),
  }));

  app.get(
    "/suppliers/by-actor/:actorId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { actorId?: string };
      const actorId = parse(Id, params.actorId, reply);
      if (!actorId) return;
      const supplier = await commerce.getSupplierByActor(actorId);
      if (!supplier) return fail(reply, 404, "supplier not found");
      return supplier;
    },
  );

  app.patch(
    "/suppliers/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(UpdateSupplierBody, request.body, reply);
      if (!body) return;
      const supplier = await commerce.updateSupplier(id, body);
      if (!supplier) return fail(reply, 404, "supplier not found");
      return supplier;
    },
  );
}