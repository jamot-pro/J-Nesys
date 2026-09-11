import type { ReactNode } from "react";

import { loadOrgBranding } from "@/lib/org";
import { ConsoleGate } from "./ConsoleGate";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/**
 * Server wrapper every console route uses: resolves the org from the request
 * subdomain, then hands the branded shell to ConsoleGate.
 *
 * Branding is fetched per request on the server so the first paint is already
 * branded — a client-side fetch would flash the default palette first.
 */
export async function ConsoleFrame({ children }: { children: ReactNode }) {
  const org = await loadOrgBranding();

  if (!org) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        <div className="card">
          <div className="card-kicker">Jamot</div>
          <div className="card-title">No organization here</div>
          <p className="card-body">
            This deployment serves one console per organization, chosen by subdomain.
            {ROOT_DOMAIN
              ? ` Reach an organization at <org>.${ROOT_DOMAIN}.`
              : " NEXT_PUBLIC_ROOT_DOMAIN is not set, so no subdomain can be resolved."}
          </p>
        </div>
      </main>
    );
  }

  return <ConsoleGate branding={org}>{children}</ConsoleGate>;
}
