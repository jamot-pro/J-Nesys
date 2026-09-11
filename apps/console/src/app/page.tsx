import { ConsoleShell } from "@/components/ConsoleShell";
import { loadOrgBranding } from "@/lib/org";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

export default async function ConsoleHome() {
  const org = await loadOrgBranding();

  // No org resolved (bare root domain, reserved or unknown subdomain). There
  // is nothing to sign in to, so don't offer a login form.
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

  return <ConsoleShell slug={org.slug} branding={org} />;
}
