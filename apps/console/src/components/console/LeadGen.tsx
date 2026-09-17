"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgents,
  listActors,
  runLeadList,
  type ApiAgent,
  type ApiActor,
  type LeadList,
} from "@jamot/client";
import {
  MapAreaPicker,
  useLeadListRun,
  useLeadListsController,
  usePeopleListsController,
  type MapArea,
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

/** How far along a running search is, from leadCount (found so far) vs. the requested limit. */
function progressPercent(list: LeadList): number {
  const limit = typeof list.providerConfig.limit === "number" ? list.providerConfig.limit : 100;
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((list.leadCount / limit) * 100));
}

function ResearchCard({
  list,
  selected,
  onSelect,
}: {
  list: LeadList;
  selected: boolean;
  onSelect: () => void;
}) {
  const running = list.status === "running";
  const percent = progressPercent(list);
  const statusLabel =
    list.status === "complete" ? "Done" :
    list.status === "failed" ? "Failed" :
    list.status === "running" ? `${percent}%` : list.status;

  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left",
        border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-divider)"}`,
        borderRadius: "var(--radius-sm)",
        background: "var(--color-bg)",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {list.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            color: list.status === "failed" ? "var(--accent-ink)" : MUTED,
            flex: "none",
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "var(--color-divider)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${running ? percent : 100}%`,
            background:
              list.status === "failed" ? "var(--accent-ink)" : "var(--color-accent)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: MUTED }}>
        {list.leadCount} found{running ? "…" : ""}
      </span>
    </button>
  );
}

/**
 * Lead Generation, deliberately minimal: one thing to say who you're looking
 * for (the target prompt), one existing People list to save into, how many
 * leads, one city + radius, and an optional "what not to search" exclusion.
 * Then Search. A run is fire-and-forget on the server (packages/api's /run
 * route doesn't block on it), so pressing Search again immediately starts a
 * second, independent search — the "Research" panel below polls every
 * running list's real progress (found-so-far vs. the requested limit) and
 * lets you switch which one's results the table shows.
 */
export function LeadGen() {
  const { organizationId, spaceId } = useOrgScope();

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);

  const { lists, providers, update, create } = useLeadListsController(spaceId, organizationId);
  const { lists: peopleLists } = usePeopleListsController(spaceId);
  const [listId, setListId] = useState<string>("");
  const [peopleListId, setPeopleListId] = useState<string>("");
  const { leads: results, enrichOne } = useLeadListRun(listId || null);
  const [submitting, setSubmitting] = useState(false);

  const [icp, setIcp] = useState("");
  const [exclude, setExclude] = useState("");
  const [area, setArea] = useState<MapArea | null>(null);
  const [volume, setVolume] = useState(50);
  const [enrichTask, setEnrichTask] = useState(ENRICH_TASKS[0]!);
  const [enrichScope, setEnrichScope] = useState<"new" | "list" | "missing">("new");
  const [enriching, setEnriching] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    [listId, update],
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

  // Lead Generation never creates a People List itself — it only searches
  // into one that already exists (created over in People). Default to the
  // first one once they've loaded, same idea as picking a default provider.
  useEffect(() => {
    if (!peopleListId && peopleLists[0]) setPeopleListId(peopleLists[0].id);
  }, [peopleLists, peopleListId]);

  // Once at least one search has run, keep showing its results below by
  // default — but only until the user picks a different card themselves.
  useEffect(() => {
    if (!listId && lists[0]) setListId(lists[0].id);
  }, [lists, listId]);

  const provider = providers.find((p) => p.configured) ?? providers[0];

  async function search() {
    if (!area) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!provider) throw new Error("no lead provider is available");
      if (!peopleListId) {
        throw new Error("Create a People list first (in People), then pick it here.");
      }

      const persona = { summary: icp.trim(), keywords: [], titles: [] as string[] };
      const created = await create({
        name: `${area.place.split(",")[0]} — ${new Date().toLocaleDateString()}`,
        providerId: provider.id,
        persona: persona as never,
        area,
        peopleListId,
        providerConfig: {
          limit: volume,
          ...(exclude.trim() ? { exclude: exclude.trim() } : {}),
        },
      });
      // Fire-and-forget: the API responds immediately with status "running"
      // and keeps working server-side, so this search doesn't block a second
      // one from starting right after. The Research panel's polling (inside
      // useLeadListsController) is what shows it progressing.
      void runLeadList(created.id, volume).catch((err) => {
        setError(err instanceof Error ? err.message : "The search failed to start.");
      });
      setListId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The search failed.");
    } finally {
      setSubmitting(false);
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
            Say who you're looking for, pick a list to save them in, set how many, and pick a city.
            Press Search — that's it. Start as many searches as you like; each runs on its own.
          </p>
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

      {lists.length > 0 ? (
        <section style={{ ...CARD, marginBottom: "var(--space-3)" }}>
          <span style={UPPER}>Research</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
            {lists.map((l) => (
              <ResearchCard key={l.id} list={l} selected={l.id === listId} onSelect={() => setListId(l.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section style={CARD}>
        <span style={UPPER}>Who are we searching?</span>
        <textarea
          className="input"
          rows={4}
          value={icp}
          onChange={(e) => setIcp(e.target.value)}
          placeholder="e.g. Independent restaurants worth reaching out to for a POS/payments offering."
        />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        <section style={CARD}>
          <span style={UPPER}>Where do we save them?</span>
          {peopleLists.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
              No People lists yet. Create one in <strong>People</strong>, then come back here.
            </p>
          ) : (
            <select
              className="input"
              value={peopleListId}
              onChange={(e) => setPeopleListId(e.target.value)}
            >
              {peopleLists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </section>

        <section style={CARD}>
          <span style={UPPER}>Number of leads</span>
          <input
            className="input"
            type="number"
            min={5}
            max={500}
            step={5}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value) || 5)}
          />
        </section>
      </div>

      <section style={{ ...CARD, marginTop: "var(--space-3)" }}>
        <span style={UPPER}>Area</span>
        <MapAreaPicker value={area} onChange={setArea} height={280} />
      </section>

      <section style={{ ...CARD, marginTop: "var(--space-3)" }}>
        <span style={UPPER}>What not to search (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          placeholder="e.g. fast food chains, closed businesses"
        />
      </section>

      <button
        className="btn btn-primary"
        style={{ marginTop: "var(--space-4)", width: "100%" }}
        onClick={() => void search()}
        disabled={submitting || !area || !peopleListId}
      >
        {submitting ? "Starting…" : "Search"}
      </button>

      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-6)" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Results</h2>
        <span style={{ fontSize: 12, color: MUTED }}>
          {current ? `${current.name} · ${results.length} in this list` : `${results.length} in this list`}
        </span>
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
              <tr><td colSpan={6} style={{ padding: "10px var(--space-3)", color: MUTED }}>Nothing found yet. Pick a city and press Search.</td></tr>
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
