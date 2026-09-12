"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addAgentRelationship,
  createAgent,
  getAgentActivity,
  getAgents,
  getMe,
  listActors,
  listAgentRelationships,
  listConnectors,
  listEnabledModels,
  listSkills,
  removeAgentRelationship,
  updateAgent,
  type ApiActor,
  type ApiAgent,
  type ApiAgentRelationship,
  type ApiConnector,
  type ApiEvent,
  type ApiSkill,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 70%, transparent)";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

const CARD: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-4)",
};

const H3: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/**
 * The mockup's segmented control, carrying autonomy.
 *
 * The mockup labels it "Effort", but an agent has no effort field — writing to
 * one would be a control that saves nothing. Autonomy is the real three-way
 * setting on the record, and it is what actually governs how a run proceeds.
 */
const AUTONOMY = [
  { id: "suggest", label: "Suggest", note: "Drafts everything and waits. Nothing leaves without you." },
  { id: "approve", label: "Approve", note: "Acts on its own, but each outward action needs your yes." },
  { id: "autonomous", label: "Autonomous", note: "Runs unattended inside its skills, tools and budget." },
] as const;

type AutonomyId = (typeof AUTONOMY)[number]["id"];

/** A connector's short mark, as the mockup's tools list draws it. */
function mono(provider: string): string {
  return provider.replace(/[^a-z0-9]/gi, "").slice(0, 3).toLowerCase() || "??";
}

function when(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/**
 * Agent configurator — a port of AgentConfigurator.dc.html, styles verbatim:
 * roster rail, score header with its component bars, purpose, reports-to,
 * model, the segmented control, skill pills and the tools list.
 *
 * Two departures, both because the API has no such field and a control that
 * saves nothing is worse than an honest one:
 *
 *  - "Effort" is autonomy, which is the real three-way setting on an agent.
 *  - "Evolution" — generations, deltas, an Evolve button — has no backend at
 *    all. In its place is the agent's real activity, which is the same shape
 *    of question ("what has changed, and when") answered with rows that exist.
 *
 * Score and its parts are real: `agent.performance` is a map of named numbers.
 */
export function AgentConfigurator() {
  const { organizationId } = useOrgScope();

  const [agents, setAgents] = useState<ApiAgent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);
  const [relationships, setRelationships] = useState<ApiAgentRelationship[]>([]);
  const [activity, setActivity] = useState<ApiEvent[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState("");

  const loadAgents = useCallback(async () => {
    const all = await getAgents();
    const mine = all.filter((a) => a.organizationIds.includes(organizationId));
    setAgents(mine);
    setSelectedId((current) => current ?? mine[0]?.id ?? null);
  }, [organizationId]);

  useEffect(() => {
    void (async () => {
      try {
        const [me, sk, cn, md, ac] = await Promise.all([
          getMe(),
          listSkills(organizationId).catch(() => []),
          listConnectors(organizationId).catch(() => []),
          listEnabledModels().catch(() => []),
          listActors().catch(() => []),
        ]);
        setOwnerId(me.actor.id);
        setSkills(sk);
        setConnectors(cn);
        setModels(md.map((m) => ({ id: m.modelId, label: `${m.providerName} · ${m.modelId}` })));
        setActors(ac);
        await loadAgents();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load agents.");
        setAgents([]);
      }
    })();
  }, [organizationId, loadAgents]);

  const selected = useMemo(
    () => (agents ?? []).find((a) => a.id === selectedId) ?? null,
    [agents, selectedId],
  );

  useEffect(() => {
    setPurpose(selected?.purpose ?? "");
    if (!selected) {
      setRelationships([]);
      setActivity([]);
      return;
    }
    void listAgentRelationships(selected.id).then(setRelationships).catch(() => setRelationships([]));
    void getAgentActivity(selected.id).then(setActivity).catch(() => setActivity([]));
  }, [selected]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await loadAgents();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(false);
      }
    },
    [loadAgents],
  );

  /** The mockup's headline score, from the agent's real performance map. */
  function scoreOf(agent: ApiAgent): number | null {
    const values = Object.values(agent.performance ?? {});
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  const reportsTo = relationships.find((r) => r.kind === "reports_to") ?? null;

  return (
    <div data-copilot-region="agent-configurator">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-ink)" }}>
            Agents
          </span>
          <h1 style={{ margin: "6px 0 0", fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Agent configurator
          </h1>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "64ch" }}>
            Give an agent a purpose, the skills and tools it may use, a model and how far it may go on its
            own, and someone it answers to.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ justifyContent: "flex-start" }}
          disabled={busy || !ownerId}
          onClick={() =>
            void run(async () => {
              const created = await createAgent({
                name: `Agent ${(agents?.length ?? 0) + 1}`,
                ownerId: ownerId!,
                organizationIds: [organizationId],
              });
              setSelectedId(created.id);
            })
          }
        >
          New agent
        </button>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? (
        <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p>
      ) : null}

      {agents === null ? (
        <p style={{ fontSize: 13, color: MUTED }}>Loading agents…</p>
      ) : agents.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED }}>
          No agent yet. <strong>New agent</strong> creates one you can then give a purpose.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,260px) minmax(0,1fr)",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          <aside style={{ display: "flex", flexDirection: "column", gap: 6, position: "sticky", top: 0 }}>
            {agents.map((a) => {
              const on = a.id === selectedId;
              const score = scoreOf(a);
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    font: "inherit",
                    border: `1px solid ${on ? "var(--color-text)" : "var(--color-divider)"}`,
                    background: on ? "var(--color-surface)" : "transparent",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.role ?? "Untitled agent"}
                    </span>
                    <span style={{ flex: "none", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--accent-ink)" }}>
                      {score ?? "—"}
                    </span>
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: DIM,
                    }}
                  >
                    {a.autonomy} · {a.availability}
                  </span>
                </button>
              );
            })}
          </aside>

          {selected ? (
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.01em" }}>
                      {selected.role ?? "Untitled agent"}
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>
                      {selected.harness.kind} · {selected.skillIds.length} skills ·{" "}
                      {selected.connectorIds.length} tools
                    </p>
                  </div>
                  <div style={{ flex: "none", textAlign: "right" }}>
                    <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1, color: "var(--accent-ink)" }}>
                      {scoreOf(selected) ?? "—"}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>
                      Score
                    </div>
                  </div>
                </div>

                {Object.keys(selected.performance ?? {}).length === 0 ? (
                  <p style={{ margin: "var(--space-4) 0 0", fontSize: 12, color: MUTED }}>
                    No runs scored yet — the score appears once this agent has done work.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                      gap: "var(--space-3)",
                      marginTop: "var(--space-4)",
                    }}
                  >
                    {Object.entries(selected.performance).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                          <span>{label}</span>
                          <span style={{ fontFamily: MONO, fontWeight: 700 }}>{value}</span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 999,
                            background: "color-mix(in srgb,var(--color-text) 10%,transparent)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.max(0, Math.min(100, value))}%`,
                              background: "var(--color-accent)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <h3 style={H3}>Purpose</h3>
                <textarea
                  className="input"
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  onBlur={() => {
                    if (purpose !== (selected.purpose ?? "")) {
                      void run(() => updateAgent(selected.id, { purpose: purpose || null }));
                    }
                  }}
                  style={{ width: "100%", boxSizing: "border-box", resize: "vertical", font: "inherit", fontSize: 14, lineHeight: 1.6 }}
                />
                <p style={{ margin: 0, fontSize: 12, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                  One sentence the agent reads before every run. It decides what the agent refuses as much
                  as what it does.
                </p>
              </section>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "var(--space-3)" }}>
                <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <h3 style={H3}>Reports to</h3>
                  <select
                    className="input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={reportsTo?.toActorId ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const toActorId = e.target.value;
                      void run(async () => {
                        if (reportsTo) await removeAgentRelationship(selected.id, reportsTo.id);
                        if (toActorId) {
                          await addAgentRelationship({
                            agentId: selected.id,
                            fromActorId: selected.actorId,
                            toActorId,
                            kind: "reports_to",
                          });
                        }
                        setRelationships(await listAgentRelationships(selected.id));
                      });
                    }}
                  >
                    <option value="">Nobody — runs unsupervised</option>
                    {actors
                      .filter((a) => a.id !== selected.actorId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName} {a.type === "agent" ? "— agent" : ""}
                        </option>
                      ))}
                  </select>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                    Whoever this answers to receives what it escalates, and approves what its autonomy
                    holds back.
                  </p>
                </section>

                <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <h3 style={H3}>Model</h3>
                  <select
                    className="input"
                    style={{ width: "100%", boxSizing: "border-box" }}
                    value={selected.model ?? ""}
                    disabled={busy}
                    onChange={(e) => void run(() => updateAgent(selected.id, { model: e.target.value || null }))}
                  >
                    <option value="">Platform default</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  {models.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                      No model is enabled yet — add a provider in Settings → Models.
                    </p>
                  ) : null}

                  <h3 style={{ ...H3, marginTop: "var(--space-2)" }}>Autonomy</h3>
                  <div style={{ display: "flex", gap: 0, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    {AUTONOMY.map((option) => {
                      const on = selected.autonomy === option.id;
                      return (
                        <button
                          key={option.id}
                          disabled={busy}
                          onClick={() => void run(() => updateAgent(selected.id, { autonomy: option.id as AutonomyId }))}
                          style={{
                            flex: 1,
                            padding: "9px 10px",
                            font: "inherit",
                            fontSize: 13,
                            fontWeight: on ? 700 : 400,
                            cursor: "pointer",
                            border: "none",
                            borderRight: "1px solid var(--color-divider)",
                            background: on ? "var(--color-text)" : "transparent",
                            color: on ? "var(--color-bg)" : "inherit",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                    {AUTONOMY.find((o) => o.id === selected.autonomy)?.note}
                  </p>
                </section>
              </div>

              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <h3 style={H3}>Skills</h3>
                  <span style={{ fontSize: 12, color: DIM }}>
                    {selected.skillIds.length} of {skills.length}
                  </span>
                </div>
                {skills.length === 0 ? (
                  <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: MUTED }}>
                    No skill exists yet — add them in Settings → Skills, then grant them here.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "var(--space-3)" }}>
                    {skills.map((k) => {
                      const on = selected.skillIds.includes(k.id);
                      return (
                        <button
                          key={k.id}
                          title={k.description || undefined}
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              updateAgent(selected.id, {
                                skillIds: on
                                  ? selected.skillIds.filter((id) => id !== k.id)
                                  : [...selected.skillIds, k.id],
                              }),
                            )
                          }
                          style={{
                            padding: "7px 12px",
                            borderRadius: 999,
                            font: "inherit",
                            fontSize: 13,
                            fontWeight: on ? 700 : 400,
                            cursor: "pointer",
                            border: `1px solid ${on ? "var(--accent-ink)" : "var(--color-divider)"}`,
                            background: on ? "var(--accent-ink)" : "transparent",
                            color: on ? "var(--color-bg)" : "inherit",
                          }}
                        >
                          {k.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <h3 style={H3}>Tools</h3>
                  <span style={{ fontSize: 12, color: DIM }}>
                    {selected.connectorIds.length} of {connectors.length}
                  </span>
                </div>
                {connectors.length === 0 ? (
                  <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: MUTED }}>
                    No connector exists yet — add them in Settings → Connectors, then grant them here.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: "var(--space-3)" }}>
                    {connectors.map((c) => {
                      const on = selected.connectorIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            padding: "10px 0",
                            borderTop: "1px solid var(--color-divider)",
                          }}
                        >
                          <span
                            style={{
                              flex: "none",
                              width: 26,
                              height: 26,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--color-surface)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: MONO,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            {mono(c.provider)}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{c.provider}</span>
                          <span style={{ flex: "none", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>
                            {c.type}
                          </span>
                          <button
                            className="btn btn-ghost"
                            style={{ flex: "none" }}
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                updateAgent(selected.id, {
                                  connectorIds: on
                                    ? selected.connectorIds.filter((id) => id !== c.id)
                                    : [...selected.connectorIds, c.id],
                                }),
                              )
                            }
                          >
                            {on ? "Revoke" : "Grant"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <h3 style={H3}>Activity</h3>
                  <span style={{ fontSize: 12, color: DIM }}>{activity.length} events</span>
                </div>
                {activity.length === 0 ? (
                  <p style={{ margin: "var(--space-4) 0 0", fontSize: 12, color: MUTED }}>
                    Nothing recorded yet. Every change to this agent and every run it does lands here.
                  </p>
                ) : (
                  <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: 0 }}>
                    {activity.slice(0, 20).map((e) => (
                      <div
                        key={e.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "76px 1fr auto",
                          gap: "var(--space-3)",
                          alignItems: "start",
                          padding: "12px 0",
                          borderTop: "1px solid var(--color-divider)",
                        }}
                      >
                        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--accent-ink)" }}>
                          {when(e.createdAt)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{e.type}</div>
                          {"changed" in e.payload ? (
                            <div style={{ marginTop: 3, fontSize: 12, color: DIM }}>
                              {(e.payload.changed as string[]).join(", ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ margin: "var(--space-4) 0 0", fontSize: 12, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                  The mockup shows generations here — proposed changes an agent evolves through. Nothing
                  in the platform proposes them yet, so this is the real record instead of an invented one.
                </p>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
