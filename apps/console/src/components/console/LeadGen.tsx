"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLeadList,
  getAgents,
  listLeadListLeads,
  listLeadLists,
  listLeadProviders,
  runLeadList,
  updateLeadList,
  type ApiAgent,
  type LeadList,
  type LeadProviderView,
  type LeadView,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const UPPER = {
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
} as const;

/** The mockup's map is a fixed 3x3 OpenStreetMap grid at zoom 5 — a static
 * picture of Europe with the search circle drawn over it, not a slippy map.
 * Reproduced exactly, including the tile range. */
const TILES: string[] = [];
for (let y = 9; y <= 11; y++) {
  for (let x = 15; x <= 17; x++) TILES.push(`https://tile.openstreetmap.org/5/${x}/${y}.png`);
}

const CARD: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px 6px 12px", background: "var(--color-surface)", borderRadius: 999, fontSize: 13 }}>
      {text}
      <button
        onClick={onRemove}
        title="Remove"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, background: "none", border: "none", borderRadius: 999, color: "var(--color-text)", cursor: "pointer" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Lead Generation — a port of sales-game/LeadGen.dc.html, styles verbatim,
 * wired to the real lead-list API.
 *
 * The mockup's target/keywords/area controls map onto LeadPersona and LeadArea:
 * the brief becomes persona.summary, the chips become persona.keywords, the
 * places and radius become the area. "Start" persists the list and runs it.
 */
export function LeadGen() {
  const { organizationId, spaceId } = useOrgScope();

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [providers, setProviders] = useState<LeadProviderView[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [listId, setListId] = useState<string>("");
  const [results, setResults] = useState<LeadView[]>([]);

  const [icp, setIcp] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const [volume, setVolume] = useState(50);
  const [radius, setRadius] = useState(120);
  const [pin, setPin] = useState({ x: 50, y: 50 });

  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const [a, p, l] = await Promise.all([
      getAgents().catch(() => [] as ApiAgent[]),
      listLeadProviders(spaceId, organizationId).catch(() => [] as LeadProviderView[]),
      listLeadLists(spaceId, organizationId).catch(() => [] as LeadList[]),
    ]);
    setAgents(a);
    setProviders(p);
    setLists(l);
    if (l[0] && !listId) {
      setListId(l[0].id);
      setIcp(l[0].persona.summary ?? "");
      setKeywords(l[0].persona.keywords ?? []);
      if (l[0].area?.place) setPlaces([l[0].area.place]);
      setResults(await listLeadListLeads(l[0].id).catch(() => []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, organizationId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load lead generation."));
  }, [load]);

  const provider = providers.find((p) => p.configured) ?? providers[0];

  async function start() {
    setError(null);
    setRunning(true);
    setNote("Saving the target…");
    try {
      const persona = { summary: icp.trim(), keywords, titles: [] as string[] };
      const area = places[0] ? { place: places[0], radiusKm: radius } : null;

      let id = listId;
      if (id) {
        await updateLeadList(id, { persona: persona as never, area });
      } else {
        if (!provider) throw new Error("no lead provider is available");
        const created = await createLeadList({
          spaceId,
          organizationId,
          name: places[0] ? `${places[0]} — ${new Date().toLocaleDateString()}` : "New target",
          providerId: provider.id,
          persona: persona as never,
          area,
        });
        id = created.id;
        setListId(id);
      }

      setNote("Searching…");
      const result = await runLeadList(id, volume);
      if (result.error) setError(result.error);
      setNote(`${result.added} added · ${result.skipped} skipped · ${result.totalFound} found`);
      setResults(await listLeadListLeads(id));
      setLists(await listLeadLists(spaceId, organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The run failed.");
      setNote(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div data-copilot-region="lead-generation">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Lead Generation</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            Tell an agent who you are looking for, mark the area on the map, and start. Its skills and
            tools come from its own configuration. Everything it finds lands in a People list, so
            Outreach can work it immediately.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => { setResults([]); setNote(null); }}>
            Clear results
          </button>
          <button className="btn btn-primary" style={{ justifyContent: "flex-start" }} onClick={() => void start()} disabled={running}>
            {running ? "Searching…" : "Start"}
          </button>
        </div>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 13, marginTop: 0 }}>{error}</p> : null}
      {providers.length > 0 && !providers.some((p) => p.configured) ? (
        <p style={{ color: MUTED, fontSize: 13 }}>
          No lead provider is configured, so a run cannot fetch anything:{" "}
          {providers.map((p) => p.label).join(", ")}.
        </p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "var(--space-3)" }}>
        <section style={CARD}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={UPPER}>Tell the agent the target</span>
            <select className="input" style={{ marginLeft: "auto", height: 32, width: "auto", fontSize: 12 }}>
              {agents.length === 0 ? (
                <option>no agents</option>
              ) : (
                agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.role || a.purpose || a.id.slice(0, 8)}
                  </option>
                ))
              )}
            </select>
          </div>
          <textarea
            className="input"
            rows={7}
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            placeholder="Who they are, what they run, what makes them worth reaching out to, and who to skip."
          />
        </section>

        <section style={CARD}>
          <span style={UPPER}>Keywords</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {keywords.map((k, i) => (
              <Chip key={`${k}-${i}`} text={k} onRemove={() => setKeywords((v) => v.filter((_, j) => j !== i))} />
            ))}
            <input
              className="input"
              placeholder="Add keyword, press Enter"
              style={{ flex: 1, minWidth: 180, height: 33 }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = e.currentTarget.value.trim();
                if (v) setKeywords((k) => [...k, v]);
                e.currentTarget.value = "";
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="lg-vol">Leads to find per run</label>
            <input className="input" id="lg-vol" type="number" min={5} max={500} step={5} value={volume} onChange={(e) => setVolume(Number(e.target.value) || 5)} />
          </div>
          <div className="field">
            <label htmlFor="lg-list">Destination list</label>
            <select className="input" id="lg-list" value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">Create a new list</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <section style={{ ...CARD, marginTop: "var(--space-3)", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <span style={UPPER}>Geographic area</span>
          <span style={{ fontSize: 12, color: MUTED }}>
            {places.length ? `${places.join(", ")} · ${radius} km` : "No area set"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-3)", alignItems: "flex-start" }}>
          <div
            ref={mapRef}
            onMouseDown={(e) => {
              const r = mapRef.current?.getBoundingClientRect();
              if (!r) return;
              setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            style={{ flex: 1, minWidth: 280, position: "relative", height: 360, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)", overflow: "hidden", cursor: "crosshair" }}
          >
            <div style={{ position: "absolute", top: -160, left: "50%", marginLeft: -384, width: 768, height: 768, display: "grid", gridTemplateColumns: "repeat(3,256px)", gridTemplateRows: "repeat(3,256px)", filter: "grayscale(1) contrast(1.1)" }}>
              {TILES.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- OSM tiles, fixed set
                <img key={src} src={src} alt="" width={256} height={256} style={{ display: "block", width: 256, height: 256 }} />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                width: (radius / 400) * 300,
                height: (radius / 400) * 300,
                transform: "translate(-50%,-50%)",
                borderRadius: 999,
                border: "2px solid var(--color-accent)",
                background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, width: 12, height: 12, transform: "translate(-50%,-50%)", borderRadius: 999, background: "var(--color-accent)", boxShadow: "0 0 0 3px var(--color-bg)", pointerEvents: "none" }} />
            <span style={{ position: "absolute", left: 8, bottom: 6, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              © OpenStreetMap
            </span>
          </div>

          <div style={{ flex: "none", width: 250, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div className="field">
              <label htmlFor="lg-place">Add a region or city</label>
              <input
                className="input"
                id="lg-place"
                placeholder="Type a place, press Enter"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const v = e.currentTarget.value.trim();
                  if (v) setPlaces((p) => [...p, v]);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="lg-radius">Radius — {radius} km</label>
              <input className="input" id="lg-radius" type="range" min={5} max={400} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: MUTED }}>
              Click the map to move the centre, then set how far out the agent may look.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {places.map((p, i) => (
                <Chip key={`${p}-${i}`} text={p} onRemove={() => setPlaces((v) => v.filter((_, j) => j !== i))} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {running ? (
        <div style={{ marginTop: "var(--space-3)", background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <span style={{ ...UPPER, fontSize: 13, letterSpacing: "0.08em" }}>Searching</span>
          <span style={{ fontSize: 12, color: MUTED }}>{note}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-6)" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Results</h2>
        <span style={{ fontSize: 12, color: MUTED }}>{note ?? `${results.length} in this list`}</span>
      </div>

      <div style={{ marginTop: "var(--space-3)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Name", "Company", "Area", "Title", "Source", "Status"].map((c) => (
                <th key={c} style={{ textAlign: "left", ...UPPER, fontSize: 10, color: MUTED, padding: "10px var(--space-3)", borderBottom: "1px solid var(--color-divider)" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "10px var(--space-3)", color: MUTED }}>Nothing found yet. Set a target and start.</td></tr>
            ) : (
              results.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                  <td style={{ padding: "10px var(--space-3)", whiteSpace: "nowrap", fontWeight: 600 }}>{r.person?.displayName ?? "—"}</td>
                  <td style={{ padding: "10px var(--space-3)", whiteSpace: "nowrap" }}>{r.person?.company || "—"}</td>
                  <td style={{ padding: "10px var(--space-3)", whiteSpace: "nowrap" }}>{r.person?.location || "—"}</td>
                  <td style={{ padding: "10px var(--space-3)", maxWidth: 320 }}>
                    <span style={{ display: "block", lineHeight: 1.5, color: MUTED }}>{r.person?.title || "—"}</span>
                  </td>
                  <td style={{ padding: "10px var(--space-3)", whiteSpace: "nowrap", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12 }}>{r.providerId}</td>
                  <td style={{ padding: "10px var(--space-3)", whiteSpace: "nowrap" }}>
                    <span className={r.status === "qualified" || r.status === "converted" ? "tag tag-accent" : "tag tag-neutral"}>{r.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
