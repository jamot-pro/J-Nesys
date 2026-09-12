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
    /** Canonical space id set by requireSpaceAccess: the literal "personal"
     * alias resolved to the actor's real personal space. Handlers must use
     * this for queries rather than the raw request value. */
    resolvedSpaceId?: Id;
  }
}

export {};
