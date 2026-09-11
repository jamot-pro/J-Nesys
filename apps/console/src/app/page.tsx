import { loadOrgBranding } from "@/lib/org";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/**
 * Console entry point.
 *
 * Deliberately minimal: it renders what is actually resolvable right now (the
 * org's public branding) and nothing else. Populating it with plausible-looking
 * org content before the authenticated data layer is wired would repeat the
 * mistake commit 6beea29 fixed in the cockpit.
 */
export default async function ConsoleHome() {
  const org = await loadOrgBranding();

  if (!org) {
    return (
      <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-3 px-6">
        <h1 className="font-display text-2xl font-bold">Jamot Console</h1>
        <p className="text-muted-foreground text-sm">
          This deployment serves one console per organization, chosen by subdomain.
          {ROOT_DOMAIN ? (
            <>
              {" "}
              Reach an organization at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                &lt;org&gt;.{ROOT_DOMAIN}
              </code>
              .
            </>
          ) : (
            " NEXT_PUBLIC_ROOT_DOMAIN is not set, so no subdomain can be resolved."
          )}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 px-6">
      <header className="flex items-center gap-3">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- org logos are
          // arbitrary self-hosted/remote URLs; next/image would need every org
          // host in remotePatterns, which is unknowable at build time.
          <img src={org.logoUrl} alt="" className="size-10 rounded-[var(--radius-sm)]" />
        ) : (
          <span
            aria-hidden
            className="size-10 rounded-[var(--radius-sm)] bg-space-accent"
          />
        )}
        <h1 className="font-display text-2xl font-bold">{org.displayName}</h1>
      </header>

      <section className="rounded-[var(--radius-md)] bg-card p-5 shadow-[var(--shadow-sm)]">
        <p className="text-muted-foreground text-sm">
          Console shell is live and branded for{" "}
          <strong className="text-foreground">{org.slug}</strong>. Authenticated
          sections are not wired yet.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 h-10 rounded-[var(--radius-sm)] bg-space-accent px-4 font-display text-xs font-bold tracking-wide text-space-accent-foreground uppercase disabled:opacity-60"
        >
          Sign in — not wired
        </button>
      </section>
    </main>
  );
}
