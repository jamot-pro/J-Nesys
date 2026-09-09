import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { JamotRepository } from "../repository.js";
import { clearStaleHostOnlySessionCookie, hashPassword, verifyPassword } from "../auth.js";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
});

export function authRoutes(repo: JamotRepository) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post("/auth/login", async (request, reply) => {
      const body = parse(LoginBody, request.body, reply);
      if (!body) return;

      const user = await repo.findUserByEmail(body.email.toLowerCase());
      if (!user || !user.passwordHash) return fail(reply, 401, "invalid credentials");

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) return fail(reply, 401, "invalid credentials");

      // Fresh session id + clear stale host-only cookie: guarantees a single
      // consistent session after login even if the browser still holds an old
      // pre-COOKIE_DOMAIN jamot_session cookie.
      await new Promise<void>((resolve) => {
        request.session.regenerate(() => resolve());
      });
      clearStaleHostOnlySessionCookie(reply);
      request.session.set("actorId", user.actor.id);
      request.session.set("personId", user.person.id);

      return { actor: user.actor, person: user.person };
    });

    app.post("/auth/logout", async (request) => {
      await request.session.destroy();
      return { status: "ok" };
    });

    app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
      const actorId = request.session.actorId!;
      const actor = await repo.getActor(actorId);
      if (!actor) return fail(reply, 404, "actor not found");

      const personId = request.session.personId;
      const person = personId ? await repo.getPerson(personId) : null;

      const user = await repo.findUserByActor(actorId);

      return { actor, person, isSuperAdmin: user?.isSuperAdmin ?? false };
    });

    app.post("/auth/password", { preHandler: requireAuth }, async (request, reply) => {
      const body = parse(ChangePasswordBody, request.body, reply);
      if (!body) return;

      const actorId = request.session.actorId!;
      const user = await repo.findUserByActor(actorId);
      if (!user) return fail(reply, 404, "user not found");

      if (user.passwordHash) {
        if (!body.currentPassword) {
          return fail(reply, 400, "currentPassword is required");
        }
        const valid = await verifyPassword(body.currentPassword, user.passwordHash);
        if (!valid) return fail(reply, 401, "current password is incorrect");
      }

      const passwordHash = await hashPassword(body.newPassword);
      await repo.updateUserPassword(user.person.id, passwordHash);

      return { status: "ok" };
    });
  };
}
