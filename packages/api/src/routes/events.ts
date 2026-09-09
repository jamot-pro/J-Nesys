import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { actorRoleInSpace, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const POLL_MS = 2000;

/**
 * Server-sent events for a space. Tails the canonical events outbox so new
 * people, messages and changes reach the UI without aggressive polling.
 */
export function eventsRoutes(repo: JamotRepository) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/events/stream", { preHandler: requireAuth }, async (request, reply) => {
      const query = parse(z.object({ spaceId: Id }), request.query, reply);
      if (!query) return;

      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as Id, query.spaceId);
      if (!role) return fail(reply, 403, "no access to this space");

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      raw.write(`data: ${JSON.stringify({ type: "stream.open" })}\n\n`);

      let closed = false;
      request.raw.on("close", () => {
        closed = true;
      });

      let lastSeen = new Date().toISOString();
      const timer = setInterval(() => {
        if (closed) {
          clearInterval(timer);
          return;
        }
        void (async () => {
          try {
            const events = await repo.listEvents({
              spaceId: query.spaceId,
              since: lastSeen,
              limit: 100,
            });
            if (events.length > 0) {
              for (const event of [...events].reverse()) {
                raw.write(`data: ${JSON.stringify(event)}\n\n`);
              }
              lastSeen = events[0]!.occurredAt;
            } else {
              raw.write(": hb\n\n");
            }
          } catch {
            // Keep the stream alive; the next tick retries.
          }
        })();
      }, POLL_MS);

      await new Promise<void>((resolve) => {
        request.raw.on("close", () => resolve());
      });
      clearInterval(timer);
      if (!raw.writableEnded) raw.end();
    });
  };
}
