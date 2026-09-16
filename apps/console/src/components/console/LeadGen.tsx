"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgents,
  listActors,
  type ApiAgent,
  type ApiActor,
} from "@jamot/client";
import {
  MultiCityPicker,
  useLeadListRun,
  useLeadListsController,
  type CityArea,
} from "@jamot/canvas-lead-generation";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const UPPER = {
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
} as const;

const ENRICH_TASKS = [
  "Find and verify email",
  "Verify phone and channel",
  "Write a context summary",
  "Score fit against the ICP",
  "Find the public profile",
];

interface LogLine {
  when: string;
  who: string;
  text: string;
}

const CARD: React.CSSProperties = {
  /* Without this a wide child — a select carrying a long agent name — pushes
     the card past its grid track instead of being clipped to it. */
  minWidth: 0,
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
 * Lead Generation, wired to the real lead-list API. The prompt/keywords map
 * onto LeadPersona; each selected city (packages/canvas-lead-generation's
 * MultiCityPicker — real geocoded center + radius per city, highlighted on
 * one map) becomes one LeadArea. "Search" runs the same list once per
 * selected city, sequentially, aggregating everything into one People list.
 * There is no agent to pick for the search itself — one fixed provider
 * (Apify's Google Maps actor) always reads the prompt and keywords; agent
 * selection only applies to enrichment, a separate step below.
 */
export function LeadGen() {
  const { organizationId, spaceId } = useOrgScope();

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);

  const { lists, providers, update, create } = useLeadListsController(spaceId, organizationId);
  const [listId, setListId] = useState<string>("");
  const [searchQueue, setSearchQueue] = useState<CityArea[] | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [totals, setTotals] = useState({ added: 0, skipped: 0, found: 0 });
  const { leads: results, running, error, setError, run, enrichOne } = useLeadListRun(
    listId || null,
  );
  const [starting, setStarting] = useState(false);

  const [icp, setIcp] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [cities, setCities] = useState<CityArea[]>([]);
  const [volume, setVolume] = useState(50);
  const [enrichTask, setEnrichTask] = useState(ENRICH_TASKS[0]!);
  const [enrichScope, setEnrichScope] = useState<"new" | "list" | "missing">("new");
  const [enriching, setEnriching] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  const [note, setNote] = useState<string | null>(null);

  /** An agent's name lives on its actor; role is what it does, not what it is. */
  const agentName = useCallback(
    (agent: ApiAgent) =>
      actors.find((a) => a.id === agent.actorId)?.displayName ??
      agent.role ??
      `Untitled agent · ${agent.id.slice(0, 8)}`,
    [actors],
  );

  /** Assigns an agent to the selected list and keeps the local copy in step. */
  const assignAgent = useCallback(
    async (field: "agentId" | "enrichmentAgentId", value: string) => {
      if (!listId) return;
      try {
        await update(listId, { [field]: value || null });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign that agent.");
      }
    },
    [listId, update, setError],
  );

  /** The list the agent selects apply to. */
  const current = lists.find((l) => l.id === listId) ?? null;

  const loadAgents = useCallback(async () => {
    const [a, actorList] = await Promise.all([
      getAgents().catch(() => [] as ApiAgent[]),
      listActors().catch(() => [] as ApiActor[]),
    ]);
    setAgents(a);
    setActors(actorList);
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // Once the lists load, default to the first one and seed the form from it —
  // console shows a single "current target", unlike web's multi-list sidebar.
  useEffect(() => {
    const first = lists[0];
    if (!first || listId) return;
    setListId(first.id);
    setIcp(first.persona.summary ?? "");
    setKeywords(first.persona.keywords ?? []);
    if (first.area?.center && first.area.radiusKm) {
      setCities([{ place: first.area.place, center: first.area.center, radiusKm: first.area.radiusKm }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists]);

  // Runs one city at a time against `listId`. Queued rather than looped
  // inline because a freshly created list's id only takes effect on
  // `useLeadListRun(listId)` after a render — the same reason a single run
  // used to be deferred — and queuing generalizes that to N cities.
  useEffect(() => {
    if (!searchQueue || searchQueue.length === 0 || !listId) return;
    const [city, ...rest] = searchQueue as [CityArea, ...CityArea[]];
    const step = queueTotal - rest.length;
    setNote(`Searching ${city.place.split(",")[0]} (${step}/${queueTotal})…`);

    void (async () => {
      try {
        await update(listId, { area: city });
        const result = await run(volume);
        if (result) {
          if (result.error) setError(result.error);
          setTotals((t) => ({
            added: t.added + result.added,
            skipped: t.skipped + result.skipped,
            found: t.found + result.totalFound,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "The run failed.");
      } finally {
        if (rest.length === 0) {
          setStarting(false);
          setSearchQueue(null);
        } else {
          setSearchQueue(rest);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, searchQueue]);

  // Once every queued city has run, summarize — the queue effect above only
  // has per-step totals, not the final tally, since it fires per city.
  useEffect(() => {
    if (starting || searchQueue !== null) return;
    if (totals.added || totals.skipped || totals.found) {
      setNote(`${totals.added} added · ${totals.skipped} skipped · ${totals.found} found`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting, searchQueue]);

  const provider = providers.find((p) => p.configured) ?? providers[0];

  async function search() {
    if (cities.length === 0) return;
    setError(null);
    setStarting(true);
    setTotals({ added: 0, skipped: 0, found: 0 });
    setQueueTotal(cities.length);
    setNote("Saving the target…");
    try {
      const persona = { summary: icp.trim(), keywords, titles: [] as string[] };

      if (listId) {
        await update(listId, { persona: persona as never });
        setSearchQueue(cities);
      } else {
        if (!provider) throw new Error("no lead provider is available");
        const created = await create({
          name: `${cities[0]!.place.split(",")[0]}${cities.length > 1 ? ` +${cities.length - 1}` : ""} — ${new Date().toLocaleDateString()}`,
          providerId: provider.id,
          persona: persona as never,
          area: cities[0]!,
        });
        setListId(created.id);
        // create() only persists cities[0] as the list's initial area — it
        // does not run a search. The queue below still processes all of
        // `cities` in order once useLeadListRun(listId) rebinds to this id.
        setSearchQueue(cities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The search failed.");
      setNote(null);
      setStarting(false);
    }
  }


  async function runEnrichment() {
    if (!listId || enriching) return;
    setEnriching(true);
    setError(null);
    const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const add = (who: string, text: string) => setLog((l) => [{ when: stamp(), who, text }, ...l].slice(0, 40));

    // "Applies to" narrows which records the agent touches. `missing` uses the
    // fields the API actually returns, so it never claims to filter on
    // something the payload does not carry.
    const targets = results.filter((r) => {
      if (!r.person) return false;
      if (enrichScope === "new") return r.status === "new";
      if (enrichScope === "missing") return !r.person.email || !r.person.title;
      return true;
    });

    add("Enrichment", `${enrichTask} · ${targets.length} record${targets.length === 1 ? "" : "s"}`);
    let done = 0;
    for (const target of targets) {
      if (!target.person) continue;
      try {
        // enrichOne already reloads `results` (useLeadListRun's leads) on success.
        await enrichOne(target.person.id);
        done += 1;
      } catch (err) {
        add("Error", `${target.person.displayName}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    add("Enrichment", `${done} of ${targets.length} enriched`);
    setEnriching(false);
  }

  return (
    <div data-copilot-region="lead-generation">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Lead Generation</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            Describe who you're looking for, add cities to search, and press Search. Everything found
            lands in a People list, so Outreach can work it immediately.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => setNote(null)}>
            Clear results
          </button>
          <button
            className="btn btn-primary"
            style={{ justifyContent: "flex-start" }}
            onClick={() => void search()}
            disabled={starting || running || cities.length === 0}
          >
            {starting || running ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? <p style={{ color: "var(--accent-ink)", fontSize: 13, marginTop: 0 }}>{error}</p> : null}
      {providers.length > 0 && !providers.some((p) => p.configured) ? (
        <p style={{ color: MUTED, fontSize: 13 }}>
          No lead provider is configured, so a run cannot fetch anything. Add a key in{" "}
          <strong>System configuration → Connectors → Lead providers</strong>. Available:{" "}
          {providers.map((p) => p.label).join(", ")}.
        </p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "var(--space-3)" }}>
        <section style={CARD}>
          <span style={UPPER}>Target prompt</span>
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

      <section style={{ ...CARD, marginTop: "var(--space-3)" }}>
        <span style={UPPER}>Cities</span>
        <MultiCityPicker value={cities} onChange={setCities} height={300} />
      </section>

      {starting || running ? (
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

      <div className="hr" style={{ margin: "var(--space-6) 0 var(--space-4)" }} />

      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Enrichment</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            A separate agent, a separate task. Enrichment fills in what the search could not.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ justifyContent: "flex-start" }}
          onClick={() => void runEnrichment()}
          disabled={enriching || !listId || results.length === 0}
        >
          {enriching ? "Enriching…" : "Enrich"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        <div className="field">
          <label htmlFor="lg-eagent">Enrichment agent</label>
          <select
            className="input"
            id="lg-eagent"
            style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}
            value={current?.enrichmentAgentId ?? ""}
            disabled={!listId}
            onChange={(e) => void assignAgent("enrichmentAgentId", e.target.value)}
          >
            <option value="">{agents.length === 0 ? "no agents" : "unassigned"}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{agentName(a)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lg-etask">Task</label>
          <select className="input" id="lg-etask" value={enrichTask} onChange={(e) => setEnrichTask(e.target.value)}>
            {ENRICH_TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lg-escope">Applies to</label>
          <select className="input" id="lg-escope" value={enrichScope} onChange={(e) => setEnrichScope(e.target.value as typeof enrichScope)}>
            <option value="new">Leads from the last run</option>
            <option value="list">The whole destination list</option>
            <option value="missing">Only records missing that field</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: 10 }}>
        {log.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No enrichment runs yet.</p>
        ) : (
          log.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, lineHeight: 1.5, borderBottom: "1px solid var(--color-divider)", paddingBottom: 9 }}>
              <span style={{ flex: "none", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>{l.when}</span>
              <span style={{ flex: "none", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-ink)" }}>{l.who}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{l.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
