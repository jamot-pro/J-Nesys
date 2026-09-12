"use client";

import { useCallback, useEffect, useState } from "react";
import {
  changePassword,
  createComposioConnection,
  createConnector,
  createSkill,
  deleteConnector,
  deleteComposioConnection,
  disconnectGoogle,
  deleteSkill,
  forgetMemory,
  getComposioKeyConfigured,
  getGoogleStatus,
  getMe,
  googleConnectUrl,
  listComposioConnections,
  listComposioToolkits,
  listLeadProviders,
  listConnectors,
  listMemory,
  listSkills,
  setComposioKey,
  setLeadProviderKey,
  storeMemory,
  syncGoogle,
  updateConnector,
  updateOwnActor,
  updateOwnProfile,
  updateSkill,
  type ApiConnector,
  type ComposioConnection,
  type ComposioToolkit,
  type GoogleConnectorStatus,
  type LeadProviderView,
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


/* ---- Google ----------------------------------------------------------- */

/**
 * Google — one grant, covering Gmail and Contacts read access.
 *
 * The consent screen is a redirect, not a fetch: the browser leaves for Google
 * and comes back through the API's callback, so "Connect" is a link.
 *
 * Maps is deliberately absent. Google Maps Platform authenticates with an API
 * key, not a user OAuth grant — there is nothing for a person to consent to —
 * so it belongs with the key-based connectors below, not here.
 */
function GoogleBlock() {
  const { spaceId } = useOrgScope();
  const { data: status, error, note, busy, run } = useSection<GoogleConnectorStatus>(() =>
    getGoogleStatus(spaceId),
  );

  return (
    <>
      <h3 style={{ fontSize: 15, margin: "0 0 var(--space-3)" }}>Google</h3>
      <Feedback error={error} note={note} />

      {status === null ? (
        <p style={{ fontSize: 14, color: MUTED }}>Loading…</p>
      ) : status.connected ? (
        <div className="card">
          <div className="card-kicker">Connected</div>
          <div className="card-title">{status.email ?? "Google account"}</div>
          <p className="card-body">
            {status.contactsSynced ?? 0} contacts and {status.sendersSynced ?? 0} Gmail senders
            imported into People
            {status.lastSyncAt ? ` · last sync ${new Date(status.lastSyncAt).toLocaleString()}` : ""}.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await syncGoogle(spaceId);
                  return result;
                }, "Sync finished.")
              }
            >
              {busy ? "Syncing…" : "Sync now"}
            </button>
            {status.connectorId ? (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void run(() => disconnectGoogle(status.connectorId!), "Disconnected.")}
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Connect a Google account</div>
          <p className="card-body">
            Grants read access to <strong>Gmail</strong> and <strong>Contacts</strong>. Everyone you
            correspond with becomes a person your agents can act for or reach out to.
          </p>
          <a
            className="btn btn-primary"
            href={googleConnectUrl(spaceId)}
            style={{ marginTop: "var(--space-3)", justifyContent: "flex-start", textDecoration: "none" }}
          >
            Connect Google
          </a>
        </div>
      )}

      <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: DIM }}>
        Maps is not here: Google Maps Platform authenticates with an API key rather than a personal
        grant, so add it below as a key-based connector.
      </p>
    </>
  );
}

/* ---- Composio --------------------------------------------------------- */

/**
 * Composio — the hosted catalog of third-party connectors.
 *
 * The catalog is only reachable once a platform API key is stored, so the key
 * is asked for first rather than showing an empty, unexplained list. Connecting
 * a toolkit is an OAuth redirect owned by Composio; the app leaves and returns
 * through the API's callback.
 */
function ComposioBlock() {
  const { organizationId } = useOrgScope();
  const { data, error, note, busy, run } = useSection<{
    configured: boolean;
    toolkits: ComposioToolkit[];
    connections: ComposioConnection[];
  }>(async () => {
    const { configured } = await getComposioKeyConfigured();
    if (!configured) return { configured: false, toolkits: [], connections: [] };
    const [toolkits, connections] = await Promise.all([
      listComposioToolkits().catch(() => []),
      listComposioConnections(organizationId).catch(() => []),
    ]);
    return { configured: true, toolkits, connections };
  });

  const [key, setKey] = useState("");
  const [query, setQuery] = useState("");

  if (!data) return <Feedback error={error} note={error ? null : "Loading Composio…"} />;

  const connectedKeys = new Set(data.connections.map((c) => c.toolkit));
  const matches = data.toolkits
    .filter((t) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${t.name} ${t.key} ${t.description ?? ""}`.toLowerCase().includes(q);
    })
    .slice(0, query.trim() ? 60 : 24);

  return (
    <>
      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Composio</h3>
      <Feedback error={error} note={note} />

      {!data.configured ? (
        <div className="card">
          <div className="card-kicker">Catalog unavailable</div>
          <div className="card-title">No Composio API key</div>
          <p className="card-body">
            The connector catalog lives behind a Composio key. Add one and the full toolkit list
            appears here.
          </p>
          <div className="field" style={{ marginTop: "var(--space-3)" }}>
            <label htmlFor="cmp-key">Composio API key</label>
            <input
              className="input"
              id="cmp-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: "var(--space-3)" }}
            disabled={busy || key.length === 0}
            onClick={() =>
              void run(async () => {
                await setComposioKey(key);
                setKey("");
              }, "Key stored.")
            }
          >
            Save key
          </button>
        </div>
      ) : (
        <>
          {data.connections.length > 0 ? (
            <table className="table" style={{ marginBottom: "var(--space-4)" }}>
              <thead>
                <tr><th>Toolkit</th><th>Sharing</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {data.connections.map((c) => (
                  <tr key={c.id}>
                    <td>{c.toolkit}</td>
                    <td style={{ color: MUTED }}>{c.sharing}</td>
                    <td>
                      <span className={c.status === "connected" || c.accountStatus === "ACTIVE" ? "tag tag-accent" : "tag tag-neutral"}>
                        {c.accountStatus ?? c.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => void run(() => deleteComposioConnection(c.id), "Disconnected.")}
                      >
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <div className="field">
            <label htmlFor="cmp-search">Search the catalog</label>
            <input
              className="input"
              id="cmp-search"
              placeholder="gmail, maps, slack, notion…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {data.toolkits.length === 0 ? (
            <p style={{ marginTop: "var(--space-3)", fontSize: 14, color: MUTED }}>
              The key is stored but the catalog came back empty — Composio may have rejected it.
            </p>
          ) : (
            <>
              <div
                style={{
                  marginTop: "var(--space-3)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
                  gap: "var(--space-2)",
                }}
              >
                {matches.map((t) => {
                  const already = connectedKeys.has(t.key);
                  return (
                    <div
                      key={t.key}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        border: "1px solid var(--color-divider)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-3)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14 }}>
                        {t.name}
                      </span>
                      {t.description ? (
                        <span style={{ fontSize: 12, lineHeight: 1.45, color: MUTED }}>
                          {t.description.slice(0, 120)}
                        </span>
                      ) : null}
                      <button
                        className={already ? "btn btn-secondary" : "btn btn-primary"}
                        style={{ marginTop: "auto", height: 30, fontSize: 12 }}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const { redirectUrl } = await createComposioConnection({
                              toolkit: t.key,
                              sharing: "organization",
                              organizationId,
                            });
                            /* Composio owns the consent screen; the app leaves
                               and returns through the API's callback. */
                            window.location.href = redirectUrl;
                          })
                        }
                      >
                        {already ? "Connect another" : "Connect"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: DIM }}>
                Showing {matches.length} of {data.toolkits.length} toolkits. Search to narrow it.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}


/* ---- Lead providers --------------------------------------------------- */

/** Which providers take an API key, and what to call it on screen. */
const PROVIDER_KEY_LABEL: Record<string, string> = {
  apollo: "Apollo API key",
  "google-maps": "Apify token",
};

/**
 * Lead providers — the sources Lead generation draws from.
 *
 * Their keys live here rather than on the Lead generation screen: a key is a
 * credential, and credentials belong with the other connectors.
 *
 * Keys are write-only. Nothing reads one back, so a configured provider shows
 * as configured and the field stays empty; replacing a key means entering the
 * new one, never editing the old.
 */
function LeadProvidersBlock() {
  const { organizationId, spaceId } = useOrgScope();
  const { data: providers, error, note, busy, run } = useSection<LeadProviderView[]>(() =>
    listLeadProviders(spaceId, organizationId),
  );
  const [keys, setKeys] = useState<Record<string, string>>({});

  return (
    <>
      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Lead providers</h3>
      <Feedback error={error} note={note} />

      {providers === null ? (
        <p style={{ fontSize: 14, color: MUTED }}>Loading providers…</p>
      ) : providers.length === 0 ? (
        <p style={{ fontSize: 14, color: MUTED }}>No lead provider is registered.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Provider</th><th>Status</th><th>Key</th></tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const keyLabel = PROVIDER_KEY_LABEL[p.id];
              return (
                <tr key={p.id}>
                  <td>
                    {p.label}
                    <span style={{ display: "block", fontSize: 12, color: DIM }}>{p.detail}</span>
                  </td>
                  <td>
                    <span className={p.configured ? "tag tag-accent" : "tag tag-neutral"}>
                      {p.configured ? "configured" : "not configured"}
                    </span>
                  </td>
                  <td>
                    {keyLabel ? (
                      <span style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                        <input
                          className="input"
                          type="password"
                          autoComplete="off"
                          placeholder={p.configured ? "Replace the key" : keyLabel}
                          style={{ height: 32, minWidth: 200, fontSize: 12 }}
                          value={keys[p.id] ?? ""}
                          onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                        />
                        <button
                          className="btn btn-secondary"
                          style={{ height: 32, fontSize: 12 }}
                          disabled={busy || !(keys[p.id] ?? "").length}
                          onClick={() =>
                            void run(async () => {
                              await setLeadProviderKey(p.id, organizationId, keys[p.id]!);
                              setKeys((k) => ({ ...k, [p.id]: "" }));
                            }, `${p.label} key stored.`)
                          }
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: DIM }}>
                        Configured through its connection, not a key
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p style={{ margin: "var(--space-3) 0 0", fontSize: 12, color: DIM }}>
        Stored encrypted against this organization and never read back. Google Maps searches by area
        and trade through Apify; Lead generation picks the first configured provider.
      </p>
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
      <GoogleBlock />
      <ComposioBlock />
      <LeadProvidersBlock />

      <h3 style={{ fontSize: 15, margin: "var(--space-6) 0 var(--space-3)" }}>Key-based connectors</h3>
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
      <p style={{ margin: "0 0 var(--space-3)", fontSize: 12, color: DIM }}>
        For anything that authenticates with a key rather than a personal grant — Google Maps
        Platform among them.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label htmlFor="cn-provider">Provider</label>
          <input
            className="input"
            id="cn-provider"
            placeholder="e.g. google-maps, github"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
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
