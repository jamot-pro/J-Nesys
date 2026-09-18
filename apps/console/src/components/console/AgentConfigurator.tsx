"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addAgentRelationship,
  createAgent,
  deleteAgent,
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
  uploadAgentAvatar,
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
const NOTE = "color-mix(in srgb, var(--color-text) 72%, transparent)";
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

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: DIM,
  marginBottom: 6,
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

/** The minimal step flow this screen follows — spec §37: primary steps only,
 * technical settings (heartbeat, per-action permissions) live under Advanced
 * inside Autonomy rather than getting their own step. */
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "instructions", label: "Instructions" },
  { id: "model", label: "Model" },
  { id: "capabilities", label: "Capabilities" },
  { id: "memory", label: "Memory" },
  { id: "autonomy", label: "Autonomy" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  font: "inherit",
  fontSize: 14,
  lineHeight: 1.6,
};

/**
 * Agent configurator — the console's one editing surface for an Agent,
 * organized as the minimal step flow JAMOT_SPEC.md §37 calls for: Profile,
 * Instructions, Model, Capabilities, Memory, Autonomy. Every field here maps
 * to a column that already existed on the agent/actor record — this reorders
 * and exposes what was already modeled, it doesn't add a second config
 * system alongside it. Persistence is per-field autosave-on-blur, the
 * pattern this screen already used, rather than a batched diff-and-submit.
 */
export function AgentConfigurator({ initialAgentId }: { initialAgentId?: string | null } = {}) {
  const { organizationId } = useOrgScope();

  const [agents, setAgents] = useState<ApiAgent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("profile");
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);
  const [relationships, setRelationships] = useState<ApiAgentRelationship[]>([]);
  const [activity, setActivity] = useState<ApiEvent[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  /** Deleting an agent removes its actor entirely — irreversible — so a
   * click opens a confirmation rather than deleting immediately. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [heartbeatCron, setHeartbeatCron] = useState("");

  const loadAgents = useCallback(async () => {
    const all = await getAgents();
    const mine = all.filter((a) => a.organizationIds.includes(organizationId));
    setAgents(mine);
    setSelectedId((current) => {
      if (current) return current;
      if (initialAgentId && mine.some((a) => a.id === initialAgentId)) return initialAgentId;
      return mine[0]?.id ?? null;
    });
  }, [organizationId, initialAgentId]);

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
  const selectedActor = useMemo(
    () => actors.find((a) => a.id === selected?.actorId) ?? null,
    [actors, selected],
  );

  /** An agent's name lives on its actor, so it is read from the roster. */
  const nameOf = useCallback(
    (agent: ApiAgent) =>
      actors.find((a) => a.id === agent.actorId)?.displayName ?? agent.role ?? "Untitled agent",
    [actors],
  );

  useEffect(() => {
    setName(selected ? nameOf(selected) : "");
    setTitle(selected?.role ?? "");
    setDescription(selected?.description ?? "");
    setPurpose(selected?.purpose ?? "");
    setSystemPrompt(selected?.systemPrompt ?? "");
    setBudget(selected?.budget != null ? String(selected.budget) : "");
    setHeartbeatCron(selected?.heartbeat.cron ?? "");
    setConfirmDeleteId(null);
    setAdvancedOpen(false);
    setTab("profile");
    if (!selected) {
      setRelationships([]);
      setActivity([]);
      return;
    }
    void listAgentRelationships(selected.id).then(setRelationships).catch(() => setRelationships([]));
    void getAgentActivity(selected.id).then(setActivity).catch(() => setActivity([]));
  }, [selected, nameOf]);

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

  async function deleteSelected(agent: ApiAgent) {
    setBusy(true);
    try {
      await deleteAgent(agent.id);
      await loadAgents();
      setSelectedId(null);
      setConfirmDeleteId(null);
      setError(null);
    } catch (err) {
      /* A block (e.g. this actor still owns another agent) leaves the
         confirmation open so the reason stays visible next to the button
         that triggered it, rather than clearing selection on failure. */
      setError(err instanceof Error ? err.message : "Could not delete this agent.");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarFile(agent: ApiAgent, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUri = await readAsDataUri(file);
      await uploadAgentAvatar(agent.id, dataUri);
      setActors(await listActors());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  /** Toggles organization-scoped memory — the "Company Brain" flag shown on
   * both the Capabilities and Memory tabs. One field, two relevant places to
   * see and change it; not two separate settings. */
  function toggleOrgMemory(agent: ApiAgent) {
    const has = agent.memoryScopes.includes("organization");
    void run(() =>
      updateAgent(agent.id, {
        memoryScopes: has
          ? agent.memoryScopes.filter((s) => s !== "organization")
          : [...agent.memoryScopes, "organization"],
      }),
    );
  }

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
            Give an agent a profile, instructions, a model, what it may use, what it may remember, and
            how far it may go on its own.
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
          No agent yet. <strong>New agent</strong> creates one you can then set up.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Roster: at most 3 rows visible, like the People list — pick an
              agent by scrolling this strip, not a sidebar beside the editor. */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              /* Exactly 3 rows tall (each ~54px incl. border+gap) — a hundred
                 agents sits behind the same scroll, never a taller list. */
              maxHeight: 174,
              overflowY: "auto",
            }}
          >
            {agents.map((a) => {
              const on = a.id === selectedId;
              const score = scoreOf(a);
              const avatarUrl = actors.find((x) => x.id === a.actorId)?.avatarUrl ?? null;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    font: "inherit",
                    /* A <button> does not inherit text colour from its
                       ancestors the way other elements do — without this the
                       name fell back to the browser's own control colour,
                       which stayed dark even under body[data-theme="dark"]. */
                    color: "var(--color-text)",
                    border: `1px solid ${on ? "var(--color-text)" : "var(--color-divider)"}`,
                    background: on ? "var(--color-surface)" : "transparent",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      style={{ borderRadius: "50%", flex: "none", objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-divider)",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                        fontSize: 13,
                        color: DIM,
                      }}
                    >
                      {nameOf(a).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
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
                        {nameOf(a)}
                      </span>
                      <span style={{ flex: "none", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--accent-ink)" }}>
                        {score ?? "—"}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: DIM,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.autonomy} · {a.availability}
                    </span>
                  </span>
                </button>
              );
            })}
          </aside>

          {selected ? (
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {/* --- Header: identity + score + delete, shown above every tab --- */}
              <section style={CARD}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <input
                      aria-label="Agent name"
                      value={name}
                      disabled={busy}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        const next = name.trim();
                        if (next && next !== nameOf(selected)) {
                          void run(async () => {
                            await updateAgent(selected.id, { name: next });
                            setActors(await listActors());
                          });
                        } else {
                          setName(nameOf(selected));
                        }
                      }}
                      style={{
                        width: "100%",
                        margin: 0,
                        padding: 0,
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid transparent",
                        color: "var(--color-text)",
                        font: "inherit",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                        fontSize: 24,
                        letterSpacing: "-0.01em",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--color-divider)")}
                    />
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
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      style={{
                        marginTop: 10,
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-accent)",
                        cursor: busy ? "default" : "pointer",
                      }}
                    >
                      Delete agent
                    </button>
                  </div>
                </div>

                {confirmDeleteId === selected.id ? (
                  <div
                    style={{
                      marginTop: "var(--space-4)",
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-accent)",
                      background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                      <strong>This permanently deletes {nameOf(selected)}.</strong> Its actor is removed
                      from the system entirely, not just deactivated — this cannot be undone. Anything it
                      created (lead lists, deals, skills, connectors) stays, just no longer credited to
                      it. If it still owns another agent, still has a person record, or made a custom
                      app, deletion is refused until that is resolved first.
                    </p>
                    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void deleteSelected(selected)}
                        style={{ background: "var(--color-accent)", color: "#fff", borderColor: "var(--color-accent)" }}
                      >
                        {busy ? "Deleting…" : "Yes, delete permanently"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* --- Step nav --- */}
              <div
                role="tablist"
                aria-label="Agent configuration steps"
                style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid var(--color-divider)" }}
              >
                {TABS.map((t) => {
                  const on = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.id)}
                      style={{
                        padding: "9px 14px",
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: on ? 800 : 500,
                        cursor: "pointer",
                        border: "none",
                        borderBottom: `2px solid ${on ? "var(--color-accent)" : "transparent"}`,
                        background: "none",
                        color: on ? "var(--color-text)" : DIM,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "profile" ? (
                <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {selectedActor?.avatarUrl ? (
                      <img
                        src={selectedActor.avatarUrl}
                        alt=""
                        width={64}
                        height={64}
                        style={{ borderRadius: "50%", objectFit: "cover", flex: "none" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          flex: "none",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-divider)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 800,
                          fontSize: 22,
                          color: DIM,
                        }}
                      >
                        {nameOf(selected).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <label className="btn btn-secondary" style={{ cursor: uploadingAvatar ? "default" : "pointer" }}>
                        {uploadingAvatar ? "Uploading…" : "Change avatar"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingAvatar}
                          onChange={(e) => void onAvatarFile(selected, e.target.files?.[0])}
                          style={{ display: "none" }}
                        />
                      </label>
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>PNG, JPEG, GIF, WebP or SVG — up to 2 MB.</p>
                    </div>
                  </div>

                  <div>
                    <label style={FIELD_LABEL} htmlFor="agent-title">Title</label>
                    <input
                      id="agent-title"
                      className="input"
                      style={{ width: "100%", boxSizing: "border-box" }}
                      placeholder="e.g. SDR, Support triage, Research analyst"
                      value={title}
                      disabled={busy}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => {
                        if (title !== (selected.role ?? "")) {
                          void run(() => updateAgent(selected.id, { role: title || null }));
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label style={FIELD_LABEL} htmlFor="agent-description">Description</label>
                    <textarea
                      id="agent-description"
                      className="input"
                      rows={2}
                      style={textareaStyle}
                      placeholder="A short, plain description of who this agent is."
                      value={description}
                      disabled={busy}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        if (description !== (selected.description ?? "")) {
                          void run(() => updateAgent(selected.id, { description: description || null }));
                        }
                      }}
                    />
                  </div>
                </section>
              ) : null}

              {tab === "instructions" ? (
                <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <div>
                    <label style={FIELD_LABEL} htmlFor="agent-purpose">What it does</label>
                    <textarea
                      id="agent-purpose"
                      className="input"
                      rows={3}
                      style={textareaStyle}
                      value={purpose}
                      disabled={busy}
                      onChange={(e) => setPurpose(e.target.value)}
                      onBlur={() => {
                        if (purpose !== (selected.purpose ?? "")) {
                          void run(() => updateAgent(selected.id, { purpose: purpose || null }));
                        }
                      }}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: NOTE }}>
                      One sentence the agent reads before every run. It decides what the agent refuses as
                      much as what it does.
                    </p>
                  </div>

                  <div>
                    <label style={FIELD_LABEL} htmlFor="agent-system-prompt">Personality &amp; behavior</label>
                    <textarea
                      id="agent-system-prompt"
                      className="input"
                      rows={5}
                      style={textareaStyle}
                      placeholder="How it should sound, what it should never do, how it should handle uncertainty…"
                      value={systemPrompt}
                      disabled={busy}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      onBlur={() => {
                        if (systemPrompt !== (selected.systemPrompt ?? "")) {
                          void run(() => updateAgent(selected.id, { systemPrompt: systemPrompt || null }));
                        }
                      }}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: NOTE }}>
                      Sent with every run alongside the purpose above — tone and hard limits, not the task
                      itself.
                    </p>
                  </div>
                </section>
              ) : null}

              {tab === "model" ? (
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
                </section>
              ) : null}

              {tab === "capabilities" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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
                      <h3 style={H3}>MCP tools · internal apps</h3>
                      <span style={{ fontSize: 12, color: DIM }}>
                        {selected.connectorIds.length} of {connectors.length}
                      </span>
                    </div>
                    {connectors.length === 0 ? (
                      <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: MUTED }}>
                        No connector exists yet — add them in Settings → Connectors, then grant them
                        here. This is also where Files, Web search and Browser tools appear once
                        connected.
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

                  <section style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div>
                      <h3 style={H3}>Company Brain</h3>
                      <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.6, color: NOTE, maxWidth: "50ch" }}>
                        Read and write the organization's shared memory — what the whole team has taught
                        its agents, not just this one's own history.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => toggleOrgMemory(selected)}
                      style={{ flex: "none" }}
                    >
                      {selected.memoryScopes.includes("organization") ? "Granted" : "Grant"}
                    </button>
                  </section>
                </div>
              ) : null}

              {tab === "memory" ? (
                <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div>
                      <h3 style={H3}>Agent Memory</h3>
                      <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.6, color: NOTE }}>
                        Its own history — every run it has done. Always on; an agent with no memory of
                        its own work is not an agent.
                      </p>
                    </div>
                    <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM, flex: "none" }}>
                      Always on
                    </span>
                  </div>

                  <div style={{ height: 1, background: "var(--color-divider)" }} />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <div>
                      <h3 style={H3}>Organization Memory</h3>
                      <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.6, color: NOTE, maxWidth: "50ch" }}>
                        Shared, organization-controlled memory — the same Company Brain flag on the
                        Capabilities step. Turning it on here does the same thing.
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => toggleOrgMemory(selected)}
                      style={{ flex: "none" }}
                    >
                      {selected.memoryScopes.includes("organization") ? "Granted" : "Grant"}
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: NOTE }}>
                    Temporal knowledge-graph recall (Graphiti) is infrastructure, not a per-agent setting — when
                    an operator has enabled it for this deployment, it runs automatically underneath both.
                  </p>
                </section>
              ) : null}

              {tab === "autonomy" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <h3 style={H3}>Autonomy</h3>
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
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: NOTE }}>
                      {AUTONOMY.find((o) => o.id === selected.autonomy)?.note}
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
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: NOTE }}>
                        Whoever this answers to receives what it escalates, and approves what its
                        autonomy holds back.
                      </p>
                    </section>

                    <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      <label style={FIELD_LABEL} htmlFor="agent-budget">Spending limit</label>
                      <input
                        id="agent-budget"
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="No limit"
                        style={{ width: "100%", boxSizing: "border-box" }}
                        value={budget}
                        disabled={busy}
                        onChange={(e) => setBudget(e.target.value)}
                        onBlur={() => {
                          const parsed = budget.trim() === "" ? null : Number(budget);
                          const current = selected.budget ?? null;
                          if (parsed !== current && !(parsed === null && current === null)) {
                            void run(() => updateAgent(selected.id, { budget: parsed }));
                          }
                        }}
                      />
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: NOTE }}>
                        What this agent may spend before it has to stop and ask, independent of the
                        autonomy level above.
                      </p>
                    </section>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    style={{
                      alignSelf: "flex-start",
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: DIM,
                      cursor: "pointer",
                    }}
                  >
                    {advancedOpen ? "▾ Advanced" : "▸ Advanced"}
                  </button>

                  {advancedOpen ? (
                    <section style={{ ...CARD, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      <h3 style={H3}>Heartbeat</h3>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={selected.heartbeat.enabled}
                          disabled={busy}
                          onChange={(e) =>
                            void run(() =>
                              updateAgent(selected.id, {
                                heartbeat: { ...selected.heartbeat, enabled: e.target.checked },
                              }),
                            )
                          }
                        />
                        Check in on a schedule, without waiting to be asked
                      </label>
                      {selected.heartbeat.enabled ? (
                        <>
                          <div>
                            <label style={FIELD_LABEL} htmlFor="agent-heartbeat-cron">Schedule (cron)</label>
                            <input
                              id="agent-heartbeat-cron"
                              className="input"
                              placeholder="*/30 * * * *"
                              style={{ width: "100%", boxSizing: "border-box" }}
                              value={heartbeatCron}
                              disabled={busy}
                              onChange={(e) => setHeartbeatCron(e.target.value)}
                              onBlur={() => {
                                if (heartbeatCron !== (selected.heartbeat.cron ?? "")) {
                                  void run(() =>
                                    updateAgent(selected.id, {
                                      heartbeat: { ...selected.heartbeat, cron: heartbeatCron || null },
                                    }),
                                  );
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label style={FIELD_LABEL} htmlFor="agent-heartbeat-action">On what it finds</label>
                            <select
                              id="agent-heartbeat-action"
                              className="input"
                              style={{ width: "100%", boxSizing: "border-box" }}
                              value={selected.heartbeat.onAction}
                              disabled={busy}
                              onChange={(e) =>
                                void run(() =>
                                  updateAgent(selected.id, {
                                    heartbeat: {
                                      ...selected.heartbeat,
                                      onAction: e.target.value as "act" | "ask" | "notify",
                                    },
                                  }),
                                )
                              }
                            >
                              <option value="notify">Notify only</option>
                              <option value="ask">Ask before acting</option>
                              <option value="act">Act, within its autonomy</option>
                            </select>
                          </div>
                        </>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ) : null}

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
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
