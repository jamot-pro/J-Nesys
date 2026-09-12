"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createCustomApp,
  deleteCustomApp,
  getApps,
  getOrganizationApps,
  listCustomApps,
  setOrganizationApps,
  type AppManifest,
  type CustomAppManifest,
} from "@jamot/client";

import { useOrgScope } from "../console-context";
import { ICONS } from "./mockup-data";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 74%, transparent)";

/** The rail's icon per app id, falling back to a generic mark. */
function iconFor(id: string): string {
  return ICONS[id] ?? ICONS.docs!;
}

interface Row extends AppManifest {
  enabled: boolean;
  /** Registered by this organization, so it can be removed entirely. */
  customId: string | null;
}

/**
 * Apps — a port of OrgConsole.dc.html's `isApps` configuration section
 * (lines 1207-1277): the Installed / Marketplace tabs, the search, the
 * marketplace grid and the installed list with its reorder, activate and
 * uninstall controls.
 *
 * One honest departure. The mockup shows "installed" and "active" as separate
 * states; the API has ONE — `enabledAppIds`, an ordered array on the
 * organization. So Install and Activate are the same operation here, and the
 * labels say what actually happens rather than implying a state the kernel
 * does not keep. Rail order is the array's order, which is real.
 *
 * Uninstall removes a custom app's registration entirely. Built-ins cannot be
 * uninstalled — they are the platform's catalog — only deactivated.
 */
export function AppsConfig() {
  const { organizationId } = useOrgScope();

  const [tab, setTab] = useState<"installed" | "market">("installed");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const [allocation, builtins, custom] = await Promise.all([
      getOrganizationApps(organizationId),
      getApps().catch(() => [] as AppManifest[]),
      listCustomApps(organizationId).catch(() => [] as CustomAppManifest[]),
    ]);
    // The apps payload identifies apps by slug and does not say which are
    // custom, so derive it: anything in the org catalog that the built-in
    // registry does not contain was registered by this organization.
    const builtinIds = new Set(builtins.map((b) => b.id));
    const customBySlug = new Map(custom.map((c) => [c.slug, c.id]));
    setRows(
      allocation.apps.map((a) => ({
        ...a,
        customId: builtinIds.has(a.id) ? null : (customBySlug.get(a.id) ?? null),
      })),
    );
    setOrder(allocation.enabledAppIds);
  }, [organizationId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load apps."));
  }, [load]);

  async function commit(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      await setOrganizationApps(organizationId, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update apps.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    commit(order.includes(id) ? order.filter((x) => x !== id) : [...order, id]);

  const move = (id: string, delta: number) => {
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void commit(next);
  };

  async function removeCustom(row: Row) {
    if (!row.customId) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCustomApp(organizationId, row.customId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not uninstall.");
    } finally {
      setBusy(false);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCustomApp(organizationId, { slug: slug.trim(), name: name.trim() });
      setSlug("");
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register the app.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !rows) return <p style={{ color: "var(--accent-ink)", fontSize: 14 }}>{error}</p>;
  if (!rows) return <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>;

  const matches = (r: Row) =>
    !q.trim() || (r.name + r.description).toLowerCase().includes(q.trim().toLowerCase());

  // Installed keeps rail order; everything else is the marketplace.
  const installed = order
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is Row => Boolean(r) && matches(r!));
  const market = rows.filter((r) => !r.enabled && matches(r));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {([["installed", `Installed (${order.length})`], ["market", `Marketplace (${rows.filter((r) => !r.enabled).length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              className="seg-opt"
              onClick={() => setTab(id)}
              style={tab === id ? { background: "var(--color-text)", color: "var(--color-bg)" } : { background: "transparent", color: "var(--color-text)" }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Search apps — invoices, calendar, support…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220, maxWidth: 380, height: 36 }}
        />
      </div>

      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 13 }}>{error}</p> : null}

      {tab === "market" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: "var(--space-3)" }}>
            {market.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", padding: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ flex: "none", width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                      <path d={iconFor(m.id)} />
                    </svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: DIM }}>
                      {m.customId ? "This organization" : "Jamot"} · v{m.version}
                    </span>
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "color-mix(in srgb, var(--color-text) 80%, transparent)" }}>{m.description}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "auto" }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
                    {m.tools.length} tool{m.tools.length === 1 ? "" : "s"}
                  </span>
                  <button className="btn btn-primary" disabled={busy} onClick={() => void toggle(m.id)} style={{ marginLeft: "auto", justifyContent: "flex-start" }}>
                    Install
                  </button>
                </div>
              </div>
            ))}
          </div>
          {market.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: DIM }}>No marketplace app matches that.</p>
          ) : null}
          <p style={{ margin: "var(--space-4) 0 0", fontSize: 12, color: MUTED }}>
            Installing puts the app in the rail immediately; you can deactivate it again from
            Installed.
          </p>

          <form className="card" onSubmit={register} style={{ marginTop: "var(--space-4)" }}>
            <div className="card-title">Register your own app</div>
            <p className="card-body">
              An app this organization defines. It joins the catalog and can be installed like any
              other — and, unlike the built-ins, removed again.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="ap-slug">Slug</label>
                <input className="input" id="ap-slug" required placeholder="invoices" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ap-name">Name</label>
                <input className="input" id="ap-name" required placeholder="Invoices" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "var(--space-4)" }}>
              Register
            </button>
          </form>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {installed.map((app, i) => (
              <div key={app.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", padding: "var(--space-3) var(--space-4)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.8 }}>
                  <path d={iconFor(app.id)} />
                </svg>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>{app.name}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>{app.description}</span>
                </div>
                <span style={{ flex: "none", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, width: 74 }}>
                  {app.customId ? "Custom" : "Built-in"}
                </span>
                <div style={{ flex: "none", display: "flex", gap: "var(--space-2)" }}>
                  <button className="btn btn-secondary btn-icon" title="Move up in rail" disabled={busy || i === 0} onClick={() => move(app.id, -1)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
                  </button>
                  <button className="btn btn-secondary btn-icon" title="Move down in rail" disabled={busy || i === installed.length - 1} onClick={() => move(app.id, 1)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  <button className="btn btn-secondary" disabled={busy} onClick={() => void toggle(app.id)} style={{ minWidth: 104, justifyContent: "flex-start" }}>
                    Deactivate
                  </button>
                  {app.customId ? (
                    <button className="btn btn-ghost" disabled={busy} onClick={() => void removeCustom(app)} style={{ justifyContent: "flex-start" }}>
                      Uninstall
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {installed.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: DIM }}>
              {order.length === 0 ? "No apps installed. Add some from the marketplace." : "Nothing installed matches that. Try the marketplace."}
            </p>
          ) : null}
          <p style={{ margin: "var(--space-4) 0 0", fontSize: 12, color: MUTED }}>
            Rail order follows this list. Deactivating takes an app out of the rail; built-ins stay
            in the marketplace, custom apps can be removed entirely.
          </p>
        </>
      )}
    </>
  );
}
