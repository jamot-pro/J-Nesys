import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { NewConnectorInput, VaultRepository } from "./types.js";

export interface ChannelRoutesOptions {
  repository: Pick<
    VaultRepository,
    "createConnector" | "getConnector" | "listConnectors"
  >;
}

const CreateChannelBody = z.object({
  kind: z.enum(["whatsapp", "matrix", "telegram"]),
});

export default async function channelsRoutes(
  app: FastifyInstance,
  opts: ChannelRoutesOptions,
): Promise<void> {
  const { repository } = opts;

  app.post("/channels", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateChannelBody, request.body, reply);
    if (!body) return;

    const input: NewConnectorInput = {
      provider: body.kind,
      type: "channel",
      credentialRef: { ref: `channels/${body.kind}`, scope: "system" },
    };

    const connector = await repository.createConnector(input);
    reply.code(201);
    return connector;
  });

  app.get("/channels", { preHandler: requireAuth }, async () => {
    return { items: await repository.listConnectors() };
  });

  app.get("/channels/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const connector = await repository.getConnector(id);
    if (!connector) return fail(reply, 404, "channel not found");
    return connector;
  });
}
