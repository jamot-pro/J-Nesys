"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createLeadList,
  listLeadLists,
  listLeadListLeads,
  listLeadProviders,
  runLeadList,
  type LeadList,
  type LeadProviderView,
  type LeadView,
} from "@jamot/client";

import { useOrgScope } from "./console-context";

/**
 * Lead generation — LeadGen.dc.html.
 *
 * The mockup marks the target area on a map; this uses a place field instead.
 * The map needs a Google Maps key the console does not have, and `LeadArea`
 * accepts `place` on its own, so the area is expressed the way the API already
 * models it rather than shipping a dead map surface.
 */
export function LeadsSection() {
  const { organizationId, spaceId } = useOrgScope();

  const [providers, setProviders] = useState<LeadProviderView[] | null>(null);
  const [lists, setLists] = useState<LeadList[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [titles, setTitles] = useState("");
  const [place, setPlace] = useState("");
  const [providerId, setProviderId] = useState("");

  const refreshLists = useCallback(async () => {
    const items = await listLeadLists(spaceId, organizationId);
    setLists(items);
    return items;
  }, [spaceId, organizationId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, l] = await Promise.all([
          listLeadProviders(spaceId, organizationId),
          listLeadLists(spaceId, organizationId),
        ]);
        if (cancelled) return;
        setProviders(p);
        setLists(l);
        const firstConfigured = p.find((x) => x.configured) ?? p[0];
        if (firstConfigured) setProviderId(firstConfigured.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load leads.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, organizationId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createLeadList({
        spaceId,
        organizationId,
        name: name.trim(),
        providerId,
        persona: {
          titles: titles.split(",").map((t) => t.trim()).filter(Boolean),
          summary: titles.trim(),
        },
        area: place.trim() ? { place: place.trim() } : null,
      });
      setName("");
      setTitles("");
      setPlace("");
      await refreshLists();
      setSelected(created.id);
      setLeads(await listLeadListLeads(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the list.");
    } finally {
      setBusy(false);
    }
  }

  async function open(list: LeadList) {
    setSelected(list.id);
    setLeads(null);
    setError(null);
    try {
      setLeads(await listLeadListLeads(list.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.");
    }
  }

  async function run(list: LeadList) {
    setBusy(true);
    setError(null);
    try {
      const result = await runLeadList(list.id);
      if (result.error) setError(result.error);
      await refreshLists();
      if (selected === list.id) setLeads(await listLeadListLeads(list.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The run failed.");
    } finally {
      setBusy(false);
    }
  }

  const configured = providers?.filter((p) => p.configured) ?? [];

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Lead Generation</h1>
        <p style={{ margin: "var(--space-2) 0 0", maxWidth: "60ch", opacity: 0.75, fontSize: 14 }}>
          Tell an agent who you are looking for and where. Everything it finds lands in a People
          list, so Outreach can work it immediately.
        </p>
      </header>

      {error ? (
        <p role="alert" className="card" style={{ color: "var(--accent-ink)", marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      ) : null}

      {providers && configured.length === 0 ? (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div className="card-kicker">Before you can run</div>
          <div className="card-title">No lead provider is configured</div>
          <p className="card-body">
            Lists can be created, but a run needs a configured provider:{" "}
            {providers.map((p) => p.label).join(", ") || "none available"}.
          </p>
        </div>
      ) : null}

      <form className="card" onSubmit={create} style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-title">New list</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
          <div className="field">
            <label htmlFor="ln">Name</label>
            <input className="input" id="ln" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lt">Titles (comma separated)</label>
            <input className="input" id="lt" placeholder="Head of Operations, COO" value={titles} onChange={(e) => setTitles(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lp">Area</label>
            <input className="input" id="lp" placeholder="Rotterdam" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lpr">Provider</label>
            <select className="input" id="lpr" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.configured ? "" : " — not configured"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !providerId} style={{ marginTop: "var(--space-4)" }}>
          {busy ? "Working…" : "Create list"}
        </button>
      </form>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Lists {lists ? <span style={{ opacity: 0.5 }}>({lists.length})</span> : null}
        </h2>
        {lists === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : lists.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No lists yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Leads</th>
                <th>Last run</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id}>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => void open(l)}>
                      {l.name}
                    </button>
                  </td>
                  <td>
                    <span className="tag tag-neutral">{l.status}</span>
                  </td>
                  <td>{l.leadCount}</td>
                  <td>{l.lastRunAt ? new Date(l.lastRunAt).toLocaleString() : "—"}</td>
                  <td>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(l)}>
                      Run
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected ? (
        <section>
          <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
            Results {leads ? <span style={{ opacity: 0.5 }}>({leads.length})</span> : null}
          </h2>
          {leads === null ? (
            <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
          ) : leads.length === 0 ? (
            <p style={{ opacity: 0.7, fontSize: 14 }}>Nothing found yet. Run the list.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.person?.displayName ?? "—"}</td>
                    <td>{lead.person?.title || "—"}</td>
                    <td>{lead.person?.company || "—"}</td>
                    <td>{lead.person?.location || "—"}</td>
                    <td>
                      <span className="tag tag-neutral">{lead.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </>
  );
}
