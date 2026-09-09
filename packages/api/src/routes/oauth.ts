import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { JamotRepository } from "../repository.js";
import {
  buildGoogleAuthUrl,
  clearStaleHostOnlySessionCookie,
  exchangeGoogleCode,
  fetchGoogleProfile,
  provisionUser,
} from "../auth.js";

export interface OAuthRoutesOptions {
  repository: JamotRepository;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export default async function oauthRoutes(
  app: FastifyInstance,
  opts: OAuthRoutesOptions,
): Promise<void> {
  const { repository } = opts;
  const clientId = opts.googleClientId ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = opts.googleClientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    opts.googleRedirectUri ??
    process.env.GOOGLE_REDIRECT_URI ??
    "https://api.jamot.pro/api/auth/google/callback";
  const frontendUrl = process.env.FRONTEND_URL ?? "https://mvp.jamot.pro";

  app.get("/auth/google", async (request, reply) => {
    if (!clientId) {
      return reply.code(501).send({ error: "Google OAuth is not configured: missing GOOGLE_CLIENT_ID" });
    }
    if (!redirectUri) {
      return reply.code(501).send({ error: "Google OAuth is not configured: missing GOOGLE_REDIRECT_URI" });
    }
    // Start a fresh session: regenerating the id invalidates any stale
    // pre-COOKIE_DOMAIN host-only session cookie and guarantees the OAuth
    // start→callback round-trip uses one consistent session. Two coexisting
    // jamot_session cookies would otherwise cause an "invalid oauth state"
    // mismatch in the callback.
    await new Promise<void>((resolve) => {
      request.session.regenerate(() => resolve());
    });
    clearStaleHostOnlySessionCookie(reply);
    const state = randomBytes(16).toString("hex");
    request.session.set("oauthState", state);
    return reply.redirect(buildGoogleAuthUrl(clientId, redirectUri, state));
  });

  app.get("/auth/google/callback", async (request, reply) => {
    if (!clientId) {
      return reply.code(501).send({ error: "Google OAuth is not configured: missing GOOGLE_CLIENT_ID" });
    }
    if (!clientSecret) {
      return reply.code(501).send({ error: "Google OAuth is not configured: missing GOOGLE_CLIENT_SECRET" });
    }
    if (!redirectUri) {
      return reply.code(501).send({ error: "Google OAuth is not configured: missing GOOGLE_REDIRECT_URI" });
    }

    const query = request.query as { code?: string; state?: string };
    const storedState = request.session.get("oauthState");
    if (!query.code || !query.state || query.state !== storedState) {
      return reply.code(400).send({ error: "invalid oauth state" });
    }

    try {
      const tokens = await exchangeGoogleCode(clientId, clientSecret, redirectUri, query.code);
      const profile = await fetchGoogleProfile(tokens.accessToken);

      let user = await repository.findUserByProvider("google", profile.sub);
      if (!user) user = await repository.findUserByEmail(profile.email.toLowerCase());

      if (!user) {
        const result = await provisionUser(repository, {
          email: profile.email,
          displayName: profile.name,
          passwordHash: null,
          provider: "google",
          providerId: profile.sub,
        });
        clearStaleHostOnlySessionCookie(reply);
        request.session.set("actorId", result.actor.id);
        request.session.set("personId", result.person.id);
      } else {
        clearStaleHostOnlySessionCookie(reply);
        request.session.set("actorId", user.actor.id);
        request.session.set("personId", user.person.id);
      }

      return reply.redirect(frontendUrl);
    } catch (err) {
      request.log.error(err, "google oauth callback failed");
      return reply.code(502).send({ error: "google oauth failed" });
    }
  });
}
