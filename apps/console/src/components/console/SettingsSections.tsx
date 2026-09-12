"use client";

import { useCallback, useEffect, useState } from "react";
import {
  changePassword,
  createConnector,
  createSkill,
  deleteConnector,
  deleteSkill,
  forgetMemory,
  getMe,
  listActors,
  listConnectors,
  listMemory,
  listSkills,
  storeMemory,
  updateConnector,
  updateOwnActor,
  updateOwnProfile,
  updateSkill,
  type ApiActor,
  type ApiConnector,
  type ApiMemoryEntry,
  type ApiSkill,
  type MeResponse,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 72%, transparent)";

/** Every section reports the same way, so a failure never reads as an empty list. */
function Feedback({ error, note }: { error: string | null; note: string | null }) {
  if (error) return <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p>;
  if (note) return <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, color: MUTED }}>{note}</p>;
  return null;
}

/** Shared state for a section that loads a list and mutates it. */
function useSection<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this section.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Runs a mutation and reloads, so the screen never drifts from the API. */
  const run = useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      setNote(null);
      try {
        await fn();
        await refresh();
        setError(null);
        if (done) setNote(done);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { data, error, note, busy, refresh, run, setError, setNote };
}

/* ---- Profile ---------------------------------------------------------- */

/**
 * Profile — who the signed-in person is to the platform.
 *
 * The display name belongs to the actor and the contact fields to the person,
 * so the two save through different routes; the form keeps that invisible.
 * Everything the API has no column for (role, how agents should treat you)
 * goes to `profile.selfDescribed`, the same place People uses.
 */
export function ProfileSection() {
  const { data: me, error, note, busy, refresh, run, setError, setNote } = useSection<MeResponse>(getMe);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [treatment, setTreatment] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.actor.displayName ?? "");
    setEmail(me.person?.email ?? "");
  }, [me]);

  if (!me) return <Feedback error={error} note={error ? null : "Loading your profile…"} />;

  const personId = me.person?.id ?? null;

  async function save() {
    await run(async () => {
      await updateOwnActor(me!.actor.id, { displayName: displayName.trim() });
      if (personId) {
        await updateOwnProfile(personId, {
          email: email.trim() || null,
          profile: {
            selfDescribed: {
              ...(role.trim() ? { role: { value: role.trim() } } : {}),
              ...(treatment.trim() ? { agentBriefing: { value: treatment.trim() } } : {}),
            },
          },
        });
      }
    }, "Profile saved.");
  }

  async function changeOwnPassword() {
    if (newPassword.length < 8) {
      setError("A new password needs at least 8 characters.");
      return;
    }
    setNote(null);
    try {
      await changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setError(null);
      setNote("Password changed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    }
  }

  return (
    <>
      <Feedback error={error} note={note} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label htmlFor="pf-name">Display name</label>
          <input className="input" id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pf-email">Email</label>
          <input
            className="input"
            id="pf-email"
            type="email"
            value={email}
            disabled={!personId}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-role">Role</label>
          <input
            className="input"
            id="pf-role"
            placeholder="What you do here"
            value={role}
            disabled={!personId}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-actor">Actor</label>
          <input className="input" id="pf-actor" value={`${me.actor.type} · ${me.actor.id.slice(0, 8)}`} readOnly />
        </div>
      </div>

      <div className="field" style={{ marginTop: "var(--space-3)" }}>
        <label htmlFor="pf-brief">How agents should treat you</label>
        <textarea
          className="input"
          id="pf-brief"
          rows={3}
          placeholder="Tone, what to decide without asking, what always needs you."
          value={treatment}
          disabled={!personId}
          onChange={(e) => setTreatment(e.target.value)}
        />
      </div>

      {personId ? null : (
        <p style={{ margin: "var(--space-2) 0 0", fontSize: 12, color: DIM }}>
          This actor has no person record, so only the display name can be changed here.
        </p>
      )}

      <button className="btn btn-primary" disabled={busy} style={{ marginTop: "var(--space-4)" }} onClick={() => void save()}>
        {busy ? "Saving…" : "Save profile"}
      </button>

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Password</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label htmlFor="pf-cur">Current password</label>
          <input
            className="input"
            id="pf-cur"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-new">New password</label>
          <input
            className="input"
            id="pf-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn btn-secondary"
        style={{ marginTop: "var(--space-3)" }}
        disabled={newPassword.length === 0}
        onClick={() => void changeOwnPassword()}
      >
        Change password
      </button>
    </>
  );
}

/* ---- Skills ----------------------------------------------------------- */

const SKILL_STATUS = ["draft", "validated", "deprecated"] as const;

/** Skills — what agents know how to do. Owned by the organization. */
export function SkillsSection() {
  const { organizationId } = useOrgScope();
  const { data: skills, error, note, busy, run } = useSection<ApiSkill[]>(() => listSkills(organizationId));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <>
      <Feedback error={error} note={note} />

      {skills === null ? (
        <p style={{ fontSize: 14, color: MUTED }}>Loading skills…</p>
      ) : skills.length === 0 ? (
        <p style={{ fontSize: 14, color: MUTED }}>No skill yet. Add the first one below.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Description</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td style={{ color: MUTED }}>{s.description || "—"}</td>
                <td>
                  <select
                    className="input"
                    style={{ height: 30, fontSize: 12 }}
                    value={s.status}
                    disabled={busy}
                    onChange={(e) =>
                      void run(() =>
                        updateSkill(s.id, { status: e.target.value as (typeof SKILL_STATUS)[number] }),
                      )
                    }
                  >
                    {SKILL_STATUS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => deleteSkill(s.id))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Add a skill</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label htmlFor="sk-name">Name</label>
          <input className="input" id="sk-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sk-desc">Description</label>
          <input className="input" id="sk-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <button
        className="btn btn-primary"
        style={{ marginTop: "var(--space-3)" }}
        disabled={busy || name.trim().length === 0}
        onClick={() =>
          void run(async () => {
            await createSkill({
              ownerOrganizationId: organizationId,
              name: name.trim(),
              description: description.trim(),
            });
            setName("");
            setDescription("");
          }, "Skill added.")
        }
      >
        Add skill
      </button>
    </>
  );
}

/* ---- Actors ----------------------------------------------------------- */

/**
 * Actors — every human and agent the platform knows.
 *
 * The API allows an actor to rename only itself, so this is a roster with one
 * editable row: yours. Presenting the others as editable would be a lie the
 * server would refuse.
 */
export function ActorsSection() {
  const { data, error, note, busy, run } = useSection<{ actors: ApiActor[]; me: MeResponse }>(async () => {
    const [actors, me] = await Promise.all([listActors(), getMe()]);
    return { actors, me };
  });
  const [ownName, setOwnName] = useState("");

  useEffect(() => {
    if (data) setOwnName(data.me.actor.displayName ?? "");
  }, [data]);

  if (!data) return <Feedback error={error} note={error ? null : "Loading actors…"} />;

  const { actors, me } = data;
  const humans = actors.filter((a) => a.type === "human");
  const agents = actors.filter((a) => a.type !== "human");

  return (
    <>
      <Feedback error={error} note={note} />

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-3)", fontSize: 12, color: MUTED }}>
        <span>{humans.length} human{humans.length === 1 ? "" : "s"}</span>
        <span>{agents.length} agent{agents.length === 1 ? "" : "s"}</span>
      </div>

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Id</th><th /></tr>
        </thead>
        <tbody>
          {actors.map((a) => {
            const isMe = a.id === me.actor.id;
            return (
              <tr key={a.id}>
                <td>
                  {isMe ? (
                    <input
                      className="input"
                      style={{ height: 30, maxWidth: 240 }}
                      value={ownName}
                      onChange={(e) => setOwnName(e.target.value)}
                    />
                  ) : (
                    a.displayName
                  )}
                </td>
                <td><span className="tag tag-neutral">{a.type}</span></td>
                <td style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12, color: DIM }}>
                  {a.id.slice(0, 8)}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isMe ? (
                    <button
                      className="btn btn-secondary"
                      disabled={busy || ownName.trim() === a.displayName}
                      onClick={() => void run(() => updateOwnActor(a.id, { displayName: ownName.trim() }), "Renamed.")}
                    >
                      Rename
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: DIM }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: DIM }}>
        An actor can only be renamed by itself — the API refuses anything else, so the other rows are
        shown rather than offered.
      </p>
    </>
  );
}

/* ---- Memory ----------------------------------------------------------- */

/** Memory — what the organization remembers, scoped to this organization. */
export function MemorySection() {
  const { organizationId } = useOrgScope();
  const { data: entries, error, note, busy, run } = useSection<ApiMemoryEntry[]>(() =>
    listMemory("organization", organizationId),
  );
  const [text, setText] = useState("");

  /** Entries are free-form JSON; a plain note is the common case. */
  function summarise(entry: ApiMemoryEntry): string {
    const content = entry.content as Record<string, unknown>;
    const note = content.note ?? content.text ?? content.summary;
    if (typeof note === "string") return note;
    return JSON.stringify(content);
  }

  return (
    <>
      <Feedback error={error} note={note} />

      {entries === null ? (
        <p style={{ fontSize: 14, color: MUTED }}>Loading memory…</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 14, color: MUTED }}>
          Nothing remembered yet. What you add here is available to every agent acting for this
          organization.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Remembered</th><th>Source</th><th /></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ maxWidth: 520 }}>{summarise(e)}</td>
                <td style={{ color: DIM, fontSize: 12 }}>
                  {e.provenance?.source ?? "—"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => forgetMemory(e.id))}>
                    Forget
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Remember something</h3>
      <div className="field">
        <label htmlFor="mem-note">Note</label>
        <textarea
          className="input"
          id="mem-note"
          rows={3}
          placeholder="A fact about this organization that agents should carry into every conversation."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <button
        className="btn btn-primary"
        style={{ marginTop: "var(--space-3)" }}
        disabled={busy || text.trim().length === 0}
        onClick={() =>
          void run(async () => {
            await storeMemory({
              scope: "organization",
              ownerId: organizationId,
              content: { note: text.trim() },
              provenance: { source: "self_declared" },
            });
            setText("");
          }, "Remembered.")
        }
      >
        Remember
      </button>
    </>
  );
}

/* ---- Connectors ------------------------------------------------------- */

/**
 * Connectors — connections to external tools and MCP servers.
 *
 * The secret is sent once, on creation, and stored encrypted by the API; it is
 * never read back, so there is no field here that could show it again.
 */
export function ConnectorsSection() {
  const { organizationId } = useOrgScope();
  const { data: connectors, error, note, busy, run } = useSection<ApiConnector[]>(() =>
    listConnectors(organizationId),
  );
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("mcp");
  const [secret, setSecret] = useState("");

  return (
    <>
      <Feedback error={error} note={note} />

      {connectors === null ? (
        <p style={{ fontSize: 14, color: MUTED }}>Loading connectors…</p>
      ) : connectors.length === 0 ? (
        <p style={{ fontSize: 14, color: MUTED }}>No connector yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Provider</th><th>Type</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.id}>
                <td>{c.provider}</td>
                <td style={{ color: MUTED }}>{c.type}</td>
                <td>
                  <span className={c.status === "connected" ? "tag tag-accent" : "tag tag-neutral"}>{c.status}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        updateConnector(c.id, {
                          status: c.status === "connected" ? "disconnected" : "connected",
                        }),
                      )
                    }
                  >
                    {c.status === "connected" ? "Disconnect" : "Reconnect"}
                  </button>
                  <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => deleteConnector(c.id))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Add a connector</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label htmlFor="cn-provider">Provider</label>
          <input className="input" id="cn-provider" placeholder="e.g. github" value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cn-type">Type</label>
          <input className="input" id="cn-type" value={type} onChange={(e) => setType(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginTop: "var(--space-3)" }}>
        <label htmlFor="cn-secret">Secret</label>
        <input
          className="input"
          id="cn-secret"
          type="password"
          autoComplete="off"
          placeholder="API key or token"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>
      <p style={{ margin: "var(--space-2) 0 0", fontSize: 12, color: DIM }}>
        Stored encrypted and never shown again. Replacing it means adding the connector afresh.
      </p>
      <button
        className="btn btn-primary"
        style={{ marginTop: "var(--space-3)" }}
        disabled={busy || provider.trim().length === 0 || secret.length === 0}
        onClick={() =>
          void run(async () => {
            const slug = provider.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            await createConnector({
              provider: provider.trim(),
              type: type.trim() || "mcp",
              ownerOrganizationId: organizationId,
              credentialRef: { ref: `${slug}-${Date.now()}`, scope: "organization" },
              secretPlaintext: secret,
            });
            setProvider("");
            setSecret("");
          }, "Connector added.")
        }
      >
        Add connector
      </button>
    </>
  );
}
