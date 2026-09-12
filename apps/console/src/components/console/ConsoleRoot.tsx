"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe, getOrganizations, resolveOrganizationBySubdomain, type MeResponse, type SubdomainResolution } from "@jamot/client";
import type { OrgPublicBranding } from "@jamot/client/branding";

import "@/lib/api-config";
import { ConsoleProvider } from "../console-context";
import { LoginPanel } from "../LoginPanel";
import { OrgConsole } from "./OrgConsole";
import { initialsOf } from "./mockup-data";
import type { RailOrg } from "./OrgRail";

type Phase = "checking" | "signed-out" | "loading" | "ready" | "error";

/** Session + organization gate, then the mockup shell.
 *
 * This is the only place the backend touches the UI: it decides whether to
 * show the sign-in panel or the console, and supplies the org rail with the
 * organizations you actually belong to. Membership is enforced by the API —
 * resolveOrganizationBySubdomain 403s for a non-member. */
export function ConsoleRoot({ branding }: { branding: OrgPublicBranding }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [resolution, setResolution] = useState<SubdomainResolution | null>(null);
  const [orgs, setOrgs] = useState<RailOrg[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      const res = await resolveOrganizationBySubdomain(branding.slug);
      setResolution(res);
      const mine = await getOrganizations().catch(() => []);
      setOrgs(
        mine.map((item) => ({
          id: item.organization.id,
          name: item.space.name,
          initials: initialsOf(item.space.name),
          unread: 0,
          active: item.organization.id === res.organization.id,
        })),
      );
      setPhase("ready");
    } catch (err) {
      // The previous copy blamed access for every failure, which was wrong and
      // actively misleading: a 500 from the API rendered as "access is decided
      // by the API". Only say that when the API actually refused.
      const message = err instanceof Error ? err.message : "the request failed";
      setError(
        /forbidden|no access/i.test(message)
          ? "you are not a member of this organization."
          : message,
      );
      setPhase("error");
    }
  }, [branding.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // The mockup is dark; keep the document dark from the first paint so the
  // sign-in panel does not flash light before the shell mounts.
  useEffect(() => {
    document.body.dataset.theme = "dark";
  }, []);

  if (phase === "checking") {
    return <Centered>Checking your session…</Centered>;
  }
  if (phase === "signed-out") {
    return <LoginPanel displayName={branding.displayName} onSignedIn={() => void load()} />;
  }
  if (phase === "error") {
    return (
      <Centered>
        Could not open <strong>{branding.slug}</strong>: {error}
      </Centered>
    );
  }
  if (phase !== "ready" || !me || !resolution) {
    return <Centered>Loading {branding.displayName}…</Centered>;
  }

  return (
    <ConsoleProvider value={{ me, resolution, branding }}>
      <OrgConsole branding={branding} orgs={orgs} />
    </ConsoleProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", opacity: 0.7 }}>{children}</p>
  );
}
