"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMe,
  getOrganizationApps,
  getOrganizationMembers,
  resolveOrganizationBySubdomain,
  type AppAllocation,
  type MeResponse,
  type OrganizationMember,
  type SubdomainResolution,
} from "@jamot/client";
import { signOut } from "@jamot/client/auth";
import type { OrgPublicBranding } from "@jamot/client/branding";

import "@/lib/api-config";
import { LoginPanel } from "./LoginPanel";

type Phase = "checking" | "signed-out" | "loading" | "ready" | "error";

interface OrgData {
  resolution: SubdomainResolution;
  members: OrganizationMember[];
  apps: AppAllocation;
}

export function ConsoleShell({
  slug,
  branding,
}: {
  slug: string;
  branding: OrgPublicBranding;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<OrgData | null>(null);
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
      // resolveOrganizationBySubdomain is the AUTHENTICATED counterpart of the
      // public branding endpoint: it 403s unless this actor actually has a
      // role in the org, so membership is enforced by the API, never here.
      const resolution = await resolveOrganizationBySubdomain(slug);
      const [members, apps] = await Promise.all([
        getOrganizationMembers(resolution.organization.id),
        getOrganizationApps(resolution.organization.id),
      ]);
      setData({ resolution, members, apps });
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this organization.");
      setPhase("error");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === "checking") {
    return <Centered>Checking your session…</Centered>;
  }

  if (phase === "signed-out") {
    return <LoginPanel displayName={branding.displayName} onSignedIn={() => void load()} />;
  }

  return (
    <>
      <nav className="nav">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- org logos are
          // arbitrary self-hosted/remote URLs, unknowable at build time.
          <img src={branding.logoUrl} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
        ) : null}
        <span className="nav-brand">{branding.displayName}</span>
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
            setData(null);
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
              <strong>{slug}</strong> is decided by the API, not this console.
            </p>
          </div>
        ) : null}

        {phase === "ready" && data ? <OrgOverview slug={slug} data={data} /> : null}
      </main>
    </>
  );
}

function OrgOverview({ slug, data }: { slug: string; data: OrgData }) {
  const { resolution, members, apps } = data;
  const enabled = apps.apps.filter((a) => a.enabled);

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>{resolution.space.name}</h1>
        <p style={{ margin: "var(--space-2) 0 0", opacity: 0.7, fontSize: 14 }}>
          {slug} · your role:{" "}
          <span className="tag tag-accent">{resolution.role ?? "none"}</span>
        </p>
        {resolution.organization.dream ? (
          <p style={{ margin: "var(--space-3) 0 0", maxWidth: "60ch" }}>
            {resolution.organization.dream}
          </p>
        ) : null}
      </header>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          People <span style={{ opacity: 0.5 }}>({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No members yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.personId}>
                  <td>{m.displayName}</td>
                  <td>{m.email ?? "—"}</td>
                  <td>
                    <span className="tag tag-neutral">{m.kind}</span>
                  </td>
                  <td>{m.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Enabled apps <span style={{ opacity: 0.5 }}>({enabled.length})</span>
        </h2>
        {enabled.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>
            No apps enabled for this organization yet.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "var(--space-3)" }}>
            {enabled.map((app) => (
              <div className="card" key={app.id}>
                <div className="card-kicker">v{app.version}</div>
                <div className="card-title">{app.name}</div>
                <p className="card-body">{app.description}</p>
                <div className="card-meta">
                  <span>
                    {app.tools.length} tool{app.tools.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Workspaces <span style={{ opacity: 0.5 }}>({resolution.workspaces.length})</span>
        </h2>
        {resolution.workspaces.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No workspaces yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {resolution.workspaces.map((w) => (
              <li key={w.id} style={{ fontSize: 14 }}>
                {w.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", opacity: 0.7 }}>
      {children}
    </p>
  );
}
