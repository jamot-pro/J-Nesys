"use client";

import { useEffect, useState } from "react";
import {
  getOrganizationApps,
  getOrganizationMembers,
  type AppAllocation,
  type OrganizationMember,
} from "@jamot/client";

import { useConsole } from "./console-context";

export function OrgOverview() {
  const { resolution } = useConsole();
  const [members, setMembers] = useState<OrganizationMember[] | null>(null);
  const [apps, setApps] = useState<AppAllocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [m, a] = await Promise.all([
        getOrganizationMembers(resolution.organization.id).catch(() => []),
        getOrganizationApps(resolution.organization.id).catch(() => null),
      ]);
      if (cancelled) return;
      setMembers(m);
      setApps(a);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolution.organization.id]);

  const enabled = apps?.apps.filter((a) => a.enabled) ?? [];

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>{resolution.space.name}</h1>
        <p style={{ margin: "var(--space-2) 0 0", opacity: 0.7, fontSize: 14 }}>
          {resolution.organization.slug} · your role:{" "}
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
          People {members ? <span style={{ opacity: 0.5 }}>({members.length})</span> : null}
        </h2>
        {members === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : members.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No members yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Enabled apps <span style={{ opacity: 0.5 }}>({enabled.length})</span>
        </h2>
        {enabled.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No apps enabled for this organization yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "var(--space-3)" }}>
            {enabled.map((app) => (
              <div className="card" key={app.id}>
                <div className="card-kicker">v{app.version}</div>
                <div className="card-title">{app.name}</div>
                <p className="card-body">{app.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
