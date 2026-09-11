import type { Actor, Id, Person } from "@jamot/contracts";

declare module "fastify" {
  interface Session {
    actorId?: Id;
    personId?: Id;
    oauthState?: string;
    /** Validated URL to return to after an OAuth round-trip (per-org consoles
     * start on their own subdomain, not FRONTEND_URL). */
    oauthReturnTo?: string;
    googleConnectorState?: string;
  }

  interface FastifyRequest {
    actor: Actor | null;
    person: Person | null;
  }
}

export {};
