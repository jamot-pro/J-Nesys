"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getMe,
  resolveOrganizationBySubdomain,
  type MeResponse,
  type SubdomainResolution,
} from "@jamot/client";
import { signOut } from "@jamot/client/auth";
import type { OrgPublicBranding } from "@jamot/client/branding";

import "@/lib/api-config";
import { ConsoleProvider } from "./console-context";
import { LoginPanel } from "./LoginPanel";

type Phase = "checking" | "signed-out" | "loading" | "ready" | "error";

const SECTIONS = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/outreach", label: "Outreach" },
] as const;

/**
 * Session + organization gate shared by every console route.
 *
 * Sections render only once BOTH resolve, so they can assume an org exists
 * (see useConsole). Membership is decided by the API —
 * resolveOrganizationBySubdomain 403s for a non-member — never here; this
 * component only decides what to show.
 */
export function ConsoleGate({
  branding,
  children,
}: {
  branding: OrgPublicBranding;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [resolution, setResolution] = useState<SubdomainResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    let session: MeResponse;
    try {
      session = await getMe();
    } catch {
      setPhase("signed-out");
      return;
    }
    setMe(session);
    setPhase("loading");
    try {
      setResolution(await resolveOrganizationBySubdomain(branding.slug));
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this organization.");
      setPhase("error");
    }
  }, [branding.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === "checking") return <Centered>Checking your session…</Centered>;
  if (phase === "signed-out") {
    return <LoginPanel displayName={branding.displayName} onSignedIn={() => void load()} />;
  }

  return (
    <>
      <nav className="nav">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- org logos are
          // arbitrary remote/self-hosted URLs, unknowable at build time.
          <img src={branding.logoUrl} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
        ) : null}
        <span className="nav-brand">{branding.displayName}</span>
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} aria-current={pathname === s.href ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
        <span style={{ flex: 1 }} />
        {me?.person?.email ? (
          <span style={{ fontSize: 13, opacity: 0.7 }}>{me.person.email}</span>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await signOut();
            setMe(null);
            setResolution(null);
            setPhase("signed-out");
          }}
        >
          Sign out
        </button>
      </nav>

      <main style={{ padding: "var(--space-6) var(--space-4)", maxWidth: 1100, margin: "0 auto" }}>
        {phase === "loading" ? <Centered>Loading {branding.displayName}…</Centered> : null}

        {phase === "error" ? (
          <div className="card">
            <div className="card-kicker">Not available</div>
            <div className="card-title">Cannot open this organization</div>
            <p className="card-body">{error}</p>
            <p className="card-meta">
              Signed in as {me?.person?.email ?? me?.actor.displayName}. Access to{" "}
              <strong>{branding.slug}</strong> is decided by the API, not this console.
            </p>
          </div>
        ) : null}

        {phase === "ready" && me && resolution ? (
          <ConsoleProvider value={{ me, resolution, branding }}>{children}</ConsoleProvider>
        ) : null}
      </main>
    </>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return (
    <p style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", opacity: 0.7 }}>
      {children}
    </p>
  );
}
