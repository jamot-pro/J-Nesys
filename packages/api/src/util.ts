import { z } from "zod";
import type { FastifyReply } from "fastify";

export function fail(reply: FastifyReply, code: number, message: string): void {
  reply.code(code).send({ error: message });
}

export function parse<S extends z.ZodType>(
  schema: S,
  data: unknown,
  reply: FastifyReply,
): z.infer<S> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    fail(reply, 400, result.error.issues.map((i) => i.message).join("; "));
    return null;
  }
  return result.data;
}
