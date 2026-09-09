import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { AppRegistry } from "@jamot/core/apps";
import { createAppResolver } from "@jamot/core/resolver";
import type { JamotRepository } from "../repository.js";
import { requireAuth } from "../rbac.js";
import { parse } from "../util.js";

const ResolveBody = z.object({
  spaceId: Id,
  organizationId: Id,
  actorRole: z.string().min(1),
  requiredCapabilities: z.array(z.string()),
  context: z.record(z.string(), z.unknown()).optional(),
});

export default async function resolveAppsRoutes(
  app: FastifyInstance,
  opts: { repo: JamotRepository; apps: AppRegistry },
): Promise<void> {
  const resolver = createAppResolver({ repo: opts.repo, apps: opts.apps });

  app.post("/apps/resolve", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(ResolveBody, request.body, reply);
    if (!body) return;

    return resolver.resolve({
      spaceId: body.spaceId,
      organizationId: body.organizationId,
      actorRole: body.actorRole,
      requiredCapabilities: body.requiredCapabilities,
      context: body.context,
    });
  });
}
