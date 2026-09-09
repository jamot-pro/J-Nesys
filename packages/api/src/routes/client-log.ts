import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse } from "../util.js";

const ClientLogBody = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10000).optional(),
  componentStack: z.string().max(10000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Ingests client-side errors (from the React error boundary / window error
 * handlers) so they can be diagnosed from server logs without a browser.
 */
export function clientLogRoutes(app: FastifyInstance): void {
  app.post("/client-log", async (request, reply) => {
    const body = parse(ClientLogBody, request.body, reply);
    if (!body) return;
    console.error("[client-log]", JSON.stringify(body));
    reply.code(204).send();
  });
}