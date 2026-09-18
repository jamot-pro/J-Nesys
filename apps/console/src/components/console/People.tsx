"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addPersonToList,
  createContact,
  createPeopleList,
  deletePeopleList,
  getAgents,
  listActors,
  listPeopleLists,
  removePersonFromList,
  renamePeopleList,
  setPeopleListReplyAgent,
  updatePerson,
  type ApiActor,
  type ApiAgent,
  type PeopleList,
  type PeopleListPerson,
  type PeopleNote,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 72%, transparent)";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

/** PEOPLE_COLUMNS, verbatim from the mockup. */
const COLUMNS = [
  "Name",
  "Surname",
  "Email",
  "Phone",
  "Website",
  "Profile ID",
  "Profile",
  "Context",
  "Aura",
  "Channels",
];

/** CHANNEL_MONO, verbatim from the mockup. */
const CHANNEL_MONO: Record<string, string> = {
  Email: "em",
  WhatsApp: "wa",
  LinkedIn: "in",
  Telegram: "tg",
  Voice: "vo",
  SMS: "sm",
};

/** The API names channels by provider; the mockup names them for people. */
const PROVIDER_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  voice: "Voice",
  sms: "SMS",
};

function channelLabel(provider: string): string {
  return PROVIDER_LABEL[provider.toLowerCase()] ?? provider;
}

function monoFor(label: string): string {
  return CHANNEL_MONO[label] ?? label.slice(0, 2).toLowerCase();
}

/** The mockup's aura dot: hue, size and glow all ride on the score. */
function auraDotStyle(aura: number, base: number): React.CSSProperties {
  const q = Math.max(0, Math.min(100, aura)) / 100;
  const hue = Math.round(25 + q * 120);
  const sz = `${(base + q * 6).toFixed(1)}px`;
  return {
    display: "inline-block",
    width: sz,
    height: sz,
    borderRadius: "999px",
    background: `radial-gradient(circle at 34% 28%, oklch(0.62 0.17 ${hue}), oklch(0.4 0.14 ${hue}))`,
    boxShadow: `0 0 ${(3 + q * 7).toFixed(0)}px oklch(0.68 0.19 ${hue} / ${(0.25 + q * 0.45).toFixed(2)})`,
  };
}

const TH: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
  padding: "10px var(--space-3)",
  borderBottom: "1px solid var(--color-divider)",
  whiteSpace: "nowrap",
  background: "var(--color-surface)",
};

const TD: React.CSSProperties = { padding: "10px var(--space-3)", whiteSpace: "nowrap" };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** Today as the mockup stamps a note: dd/mm. */
function noteStamp(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function publicProfileFor(person: PeopleListPerson): string {
  const slug = `${person.firstName ?? ""}-${person.lastName ?? ""}`
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
  return `jamot.pro/${slug}`;
}

/**
 * People — a port of OrgConsole.dc.html's `people-crm` region (lines 406-484)
 * and its person card (lines 485-578), styles verbatim.
 *
 * The mockup's lists are real: `people_lists` and `people_list_members` back
 * them, so a list survives a reload and is shared by everyone in the space.
 * The CRM-only fields the mockup shows — website, public profile, context,
 * aura, notes — live in the person's `profile.selfDescribed`, which is where
 * the API already keeps self-declared attributes.
 *
 * Channels are read-only here, unlike the mockup's toggles: they are derived
 * from the person's real channel identities, and inventing one by clicking a
 * pill would claim a reachability that does not exist.
 */
export function People() {
  const { spaceId } = useOrgScope();

  const [lists, setLists] = useState<PeopleList[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<{ listId: string; personId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);

  const load = useCallback(async () => {
    if (!spaceId) return;
    try {
      setLists(await listPeopleLists(spaceId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load people.");
      setLists([]);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([getAgents().catch(() => []), listActors().catch(() => [])]).then(
      ([agentItems, actorItems]) => {
        setAgents(agentItems);
        setActors(actorItems);
      },
    );
  }, []);

  /** An agent's name lives on its actor; role is what it does, not what it is. */
  const agentName = (agent: ApiAgent) =>
    actors.find((a) => a.id === agent.actorId)?.displayName ??
    agent.role ??
    `Untitled agent · ${agent.id.slice(0, 8)}`;

  /** Runs a mutation, then reloads, so the screen never drifts from the API. */
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await load();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That did not go through.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const person = open
    ? (lists ?? []).find((l) => l.id === open.listId)?.people.find((p) => p.id === open.personId) ?? null
    : null;

  const addPersonTo = (listId: string) =>
    run(async () => {
      if (!spaceId) return;
      const n = (lists ?? []).reduce((sum, l) => sum + l.people.length, 0) + 1;
      const created = await createContact(spaceId, { firstName: "New", lastName: `contact ${n}` });
      await addPersonToList(listId, created.person.id);
    });

  const patch = (p: PeopleListPerson, fields: Parameters<typeof updatePerson>[1]) =>
    run(() => updatePerson(p.id, fields));

  return (
    <div data-copilot-region="people-crm">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>People</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            The database of Humans interacting with your dream
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            style={{ justifyContent: "flex-start" }}
            disabled={busy || !lists?.length}
            onClick={() => lists?.[0] && addPersonTo(lists[0].id)}
          >
            New person
          </button>
          <button
            className="btn btn-primary"
            style={{ justifyContent: "flex-start" }}
            disabled={busy || !spaceId}
            onClick={() =>
              run(() => createPeopleList(spaceId!, `Untitled list ${(lists?.length ?? 0) + 1}`))
            }
          >
            New list
          </button>
        </div>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? (
        <p style={{ margin: "0 0 var(--space-4)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p>
      ) : null}

      {lists === null ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading people…</p>
      ) : lists.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
          No lists yet. Start one with <strong>New list</strong>, then add the people who matter to it.
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {(lists ?? []).map((list) => {
          const isOpen = collapsed[list.id] !== true;
          return (
            <section
              key={list.id}
              style={{
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg)",
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  height: 52,
                  padding: "0 var(--space-3)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [list.id]: isOpen }))}
                  title={isOpen ? "Collapse list" : "Expand list"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    flex: "none",
                    background: "none",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  <Chevron open={isOpen} />
                </button>
                <input
                  className="input"
                  defaultValue={list.name}
                  aria-label="List name"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== list.name) void run(() => renamePeopleList(list.id, name));
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    maxWidth: 340,
                    height: 34,
                    background: "none",
                    borderColor: "transparent",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                />
                <span style={{ fontSize: 12, color: MUTED }}>
                  {list.people.length === 1 ? "1 person" : `${list.people.length} people`}
                </span>
                <label
                  title="Agent that answers WhatsApp messages from anyone on this list"
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}
                >
                  Reply agent
                  <select
                    className="input"
                    value={list.replyAgentId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => setPeopleListReplyAgent(list.id, e.target.value || null))
                    }
                    style={{ height: 30, fontSize: 12, padding: "0 8px" }}
                  >
                    <option value="">No auto-reply</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agentName(agent)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-ghost btn-icon"
                  title="Delete list"
                  disabled={busy}
                  onClick={() => run(() => deletePeopleList(list.id))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              </header>

              {isOpen ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {COLUMNS.map((c) => (
                            <th key={c} style={TH}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {list.people.map((p) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                            <td style={TD}>
                              <button
                                onClick={() => setOpen({ listId: list.id, personId: p.id })}
                                title="Open profile card"
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  font: "inherit",
                                  fontWeight: 600,
                                  color: "var(--color-text)",
                                  cursor: "pointer",
                                }}
                              >
                                {p.firstName || p.displayName}
                              </button>
                            </td>
                            <td style={TD}>{p.lastName ?? ""}</td>
                            <td style={TD}>{p.email ?? ""}</td>
                            <td style={{ ...TD, fontFamily: MONO, fontSize: 12 }}>{p.phone ?? ""}</td>
                            <td style={TD}>{p.website}</td>
                            <td style={{ ...TD, fontFamily: MONO, fontSize: 12, color: MUTED }}>{p.id.slice(0, 8)}</td>
                            <td style={TD}>
                              {p.publicProfile ? (
                                <a href={`https://${p.publicProfile}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", fontFamily: MONO, fontSize: 12 }}>
                                  {p.publicProfile}
                                </a>
                              ) : (
                                <button
                                  className="btn btn-secondary"
                                  style={{ height: 30, padding: "0 12px", fontSize: 12 }}
                                  disabled={busy}
                                  onClick={() => patch(p, { publicProfile: publicProfileFor(p) })}
                                >
                                  Onboard
                                </button>
                              )}
                            </td>
                            <td style={{ padding: "10px var(--space-3)", maxWidth: 280 }}>
                              <span style={{ display: "block", lineHeight: 1.5, color: MUTED }}>{p.context}</span>
                            </td>
                            <td style={TD}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                <span style={auraDotStyle(p.aura, 7)} />
                                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{p.aura}</span>
                              </span>
                            </td>
                            <td style={TD}>
                              <span style={{ display: "flex", gap: 6 }}>
                                {p.channels.map((provider) => {
                                  const label = channelLabel(provider);
                                  return (
                                    <span
                                      key={provider}
                                      title={label}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 24,
                                        height: 24,
                                        border: "1px solid var(--color-divider)",
                                        borderRadius: 999,
                                        fontFamily: "var(--font-heading)",
                                        fontWeight: 800,
                                        fontSize: 10,
                                      }}
                                    >
                                      {monoFor(label)}
                                    </span>
                                  );
                                })}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "var(--space-3)" }}>
                    <button
                      className="btn btn-ghost"
                      style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                      disabled={busy}
                      onClick={() => addPersonTo(list.id)}
                    >
                      + Add person to this list
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      {open && person ? (
        <PersonCard
          person={person}
          listName={(lists ?? []).find((l) => l.id === open.listId)?.name ?? ""}
          busy={busy}
          onClose={() => setOpen(null)}
          onPatch={(fields) => patch(person, fields)}
          onRemove={() =>
            run(async () => {
              await removePersonFromList(open.listId, person.id);
              setOpen(null);
            })
          }
        />
      ) : null}
    </div>
  );
}

/** The mockup's `person-card` modal (lines 485-578), styles verbatim. */
function PersonCard({
  person,
  listName,
  busy,
  onClose,
  onPatch,
  onRemove,
}: {
  person: PeopleListPerson;
  listName: string;
  busy: boolean;
  onClose: () => void;
  onPatch: (fields: Parameters<typeof updatePerson>[1]) => void;
  onRemove: () => void;
}) {
  const onboarded = Boolean(person.publicProfile);
  const readonly: { label: string; value: string }[] = [
    { label: "Name", value: person.firstName || "—" },
    { label: "Surname", value: person.lastName || "—" },
    { label: "Email", value: person.email || "—" },
    { label: "Phone", value: person.phone || "—" },
    { label: "Website", value: person.website || "—" },
    { label: "Profile ID", value: person.id.slice(0, 8) },
    { label: "Public profile", value: person.publicProfile || "—" },
    { label: "Context", value: person.context || "—" },
  ];

  const addNote = (text: string) =>
    onPatch({ notes: [...person.notes, { when: noteStamp(), text }] });
  const removeNote = (index: number) =>
    onPatch({ notes: person.notes.filter((_, i) => i !== index) });

  return (
    <div
      data-copilot-region="person-card"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 58,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "color-mix(in srgb,#201e1d 32%,transparent)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            height: 56,
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.displayName}
          </span>
          <span style={{ flex: "none", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: DIM }}>
            {listName}
          </span>
          <button className="btn btn-ghost btn-icon" title="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "#fff",
                background: onboarded ? "oklch(0.45 0.13 150)" : "oklch(0.45 0.13 60)",
              }}
            >
              {onboarded ? "Onboarded" : "Not onboarded"}
            </span>
            <span style={{ flex: 1, minWidth: 180, fontSize: 12, lineHeight: 1.5, color: MUTED }}>
              {onboarded
                ? "Profile completed and owned by them — read only here."
                : "Added by lead generation or by an interaction, and not onboarded yet. Editable until they complete their profile."}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={auraDotStyle(person.aura, 8)} />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{person.aura}</span>
              <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM }}>Aura</span>
            </span>
          </div>

          {onboarded ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                {readonly.map((r) => (
                  <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM }}>
                      {r.label}
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{r.value}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: MUTED }}>
                This person owns their profile. Their fields and their aura are theirs to change — here you can only add
                notes.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <Field label="Name" value={person.firstName ?? ""} onSave={(v) => onPatch({ firstName: v })} />
                <Field label="Surname" value={person.lastName ?? ""} onSave={(v) => onPatch({ lastName: v })} />
                <Field label="Email" value={person.email ?? ""} onSave={(v) => onPatch({ email: v || null })} />
                <Field label="Phone" value={person.phone ?? ""} onSave={(v) => onPatch({ phone: v || null })} />
                <Field label="Website" value={person.website} onSave={(v) => onPatch({ website: v })} />
                <div className="field">
                  <label>Profile ID</label>
                  <input className="input" value={person.id.slice(0, 8)} readOnly />
                </div>
              </div>
              <Field
                label="Context — what the agents should know"
                value={person.context}
                multiline
                onSave={(v) => onPatch({ context: v })}
              />
              <div>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Channels
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: "var(--space-3)" }}>
                  {Object.keys(CHANNEL_MONO).map((name) => {
                    const on = person.channels.map(channelLabel).includes(name);
                    return (
                      <span
                        key={name}
                        title={on ? `Reachable on ${name}` : `No ${name} identity on file`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          height: 32,
                          padding: "0 13px",
                          background: on ? "var(--color-bg)" : "transparent",
                          border: `1px solid ${on ? "var(--color-text)" : "var(--color-divider)"}`,
                          borderRadius: 999,
                          color: "var(--color-text)",
                          font: "inherit",
                          fontSize: 12,
                          fontWeight: on ? 700 : 400,
                          opacity: on ? 1 : 0.72,
                        }}
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
                <p style={{ margin: "var(--space-3) 0 0", fontSize: 11, lineHeight: 1.5, color: DIM }}>
                  Channels come from this person&rsquo;s real identities — they appear as the channels connect.
                </p>
              </div>
            </>
          )}

          {person.contextSummary ? (
            <div>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Memory summary
              </span>
              <p style={{ margin: "var(--space-3) 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--color-text)" }}>
                {person.contextSummary}
              </p>
              <p style={{ margin: "var(--space-3) 0 0", fontSize: 11, lineHeight: 1.5, color: DIM }}>
                Auto-generated from every interaction we&rsquo;ve had with this person across channels
                {person.contextSummaryUpdatedAt
                  ? ` — last updated ${new Date(person.contextSummaryUpdatedAt).toLocaleString()}.`
                  : "."}
              </p>
            </div>
          ) : null}

          <div>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Notes
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "var(--space-3)" }}>
              {person.notes.map((n: PeopleNote, i: number) => (
                <div
                  key={`${n.when}-${i}`}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "baseline",
                    fontSize: 13,
                    lineHeight: 1.5,
                    borderBottom: "1px solid var(--color-divider)",
                    paddingBottom: 8,
                  }}
                >
                  <span style={{ flex: "none", fontFamily: MONO, fontSize: 11, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                    {n.when}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{n.text}</span>
                  <button
                    onClick={() => removeNote(i)}
                    title="Delete note"
                    disabled={busy}
                    style={{
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      background: "none",
                      border: "none",
                      borderRadius: 999,
                      color: "var(--color-text)",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <input
                className="input"
                placeholder="Write a note, press Enter"
                style={{ height: 34 }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  e.currentTarget.value = "";
                  if (value) addNote(value);
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "none",
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <button className="btn btn-primary" style={{ justifyContent: "flex-start" }} onClick={onClose}>
            Save and close
          </button>
          {onboarded ? (
            <a
              className="btn btn-secondary"
              href={`https://${person.publicProfile}`}
              target="_blank"
              rel="noreferrer"
              style={{ justifyContent: "flex-start", textDecoration: "none" }}
            >
              View public profile
            </a>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ justifyContent: "flex-start" }}
              disabled={busy}
              onClick={() => onPatch({ publicProfile: publicProfileFor(person) })}
            >
              Send onboarding link
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "auto", justifyContent: "flex-start" }}
            disabled={busy}
            onClick={onRemove}
          >
            Remove from list
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A field that commits on blur rather than on every keystroke — each save is
 * a PATCH, and firing one per character would be a request per letter typed.
 */
function Field({
  label,
  value,
  multiline,
  onSave,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (value: string) => void;
}) {
  const commit = (next: string) => {
    if (next !== value) onSave(next);
  };
  return (
    <div className="field">
      <label>{label}</label>
      {multiline ? (
        <textarea className="input" rows={3} defaultValue={value} onBlur={(e) => commit(e.target.value)} />
      ) : (
        <input className="input" defaultValue={value} onBlur={(e) => commit(e.target.value)} />
      )}
    </div>
  );
}
