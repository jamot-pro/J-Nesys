const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/** Shown when the request's subdomain names no organization. The mockup has
 * no such state — it always renders inside one org — so this is deliberately
 * plain rather than invented chrome. */
export function NoOrg() {
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
