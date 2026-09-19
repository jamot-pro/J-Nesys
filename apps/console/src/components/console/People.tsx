"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addPersonToList,
  createContact,
  createPeopleList,
  deletePeopleList,
  getAgents,
  listActors,
  listDeals,
  listPeopleLists,
  listWaAccounts,
  removePersonFromList,
  renamePeopleList,
  sendWaMessage,
  setPeopleListReplyAgent,
  updatePerson,
  type ApiActor,
  type ApiAgent,
  type ApiWaAccount,
  type Deal,
  type PeopleList,
  type PeopleListPerson,
  type PeopleNote,
} from "@jamot/client";

import { useOrgScope } from "../console-context";
import { formatPhoneDisplay } from "@/lib/utils";
import {
  createPersonPublicLink,
  getPersonDetail,
  searchPeople,
  type ApiPersonSummary,
} from "../people/people-api";

const UNLISTED_ID = "__unlisted__";

function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

/** Compact "$1.2k open" style summary of a person's deals. */
function dealsSummary(deals: Deal[]): string {
  if (deals.length === 0) return "—";
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = deals.filter((d) => d.stage === "won");
  const total = (list: Deal[]) => list.reduce((sum, d) => sum + d.valueAmount, 0);
  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      amount,
    );
  const currency = deals[0]?.currency ?? "USD";
  const parts: string[] = [];
  if (open.length > 0) parts.push(`${open.length} open · ${fmt(total(open), currency)}`);
  if (won.length > 0) parts.push(`${won.length} won · ${fmt(total(won), currency)}`);
  return parts.join(" · ") || "—";
}

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const DIM = "color-mix(in srgb, var(--color-text) 72%, transparent)";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

/** PEOPLE_COLUMNS, verbatim from the mockup. */
const COLUMNS = [
  "Name",
  "Surname",
  "Company",
  "Email",
  "Phone",
  "Context",
  "Aura",
  "Deals",
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
  const [query, setQuery] = useState("");
  const [dealsByPerson, setDealsByPerson] = useState<Record<string, Deal[]>>({});

  const [unlistedOpen, setUnlistedOpen] = useState(false);
  const [unlistedTotal, setUnlistedTotal] = useState<number | null>(null);
  const [unlistedPeople, setUnlistedPeople] = useState<ApiPersonSummary[]>([]);
  const [unlistedLoading, setUnlistedLoading] = useState(false);

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

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    listDeals(spaceId)
      .then((deals) => {
        if (cancelled) return;
        const byPerson: Record<string, Deal[]> = {};
        for (const deal of deals) {
          if (!deal.personId) continue;
          (byPerson[deal.personId] ??= []).push(deal);
        }
        setDealsByPerson(byPerson);
      })
      .catch(() => {
        if (!cancelled) setDealsByPerson({});
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  // Unlisted count stays live regardless of expand state; the fuller
  // member fetch only happens once expanded.
  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    searchPeople({ spaceId, unlisted: true, perPage: 1 })
      .then(({ total }) => {
        if (!cancelled) setUnlistedTotal(total);
      })
      .catch(() => {
        if (!cancelled) setUnlistedTotal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId || !unlistedOpen) return;
    let cancelled = false;
    setUnlistedLoading(true);
    searchPeople({ spaceId, unlisted: true, q: query || undefined, perPage: 200 })
      .then(({ items, total }) => {
        if (cancelled) return;
        setUnlistedPeople(items);
        setUnlistedTotal(total);
      })
      .catch(() => {
        if (!cancelled) setUnlistedPeople([]);
      })
      .finally(() => {
        if (!cancelled) setUnlistedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, unlistedOpen, query]);

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

      <div style={{ margin: "var(--space-4) 0", maxWidth: 420 }}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people across every list…"
          style={{ width: "100%", height: 38 }}
        />
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
          const filteredPeople = list.people.filter((p) =>
            matchesQuery(query, p.firstName, p.lastName, p.email, p.phone, p.company, p.displayName),
          );
          // Searching surfaces which list a match lives in: hide lists with
          // no match, and auto-show every match in the ones that do.
          if (query.trim() && filteredPeople.length === 0) return null;
          const isOpen = query.trim() ? true : collapsed[list.id] !== true;
          const visiblePeople = isOpen ? filteredPeople : filteredPeople.slice(0, 3);
          const hiddenCount = filteredPeople.length - visiblePeople.length;
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
                  title="Auto-reply agent for this list, on whichever channel a member writes in"
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED }}
                >
                  Agent
                  <select
                    className="input"
                    value={list.replyAgentId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => setPeopleListReplyAgent(list.id, e.target.value || null))
                    }
                    style={{ height: 28, fontSize: 12, padding: "0 6px", maxWidth: 140 }}
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
                    {visiblePeople.map((p) => (
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
                        <td style={TD}>{p.company || ""}</td>
                        <td style={TD}>{p.email ?? ""}</td>
                        <td style={{ ...TD, fontFamily: MONO, fontSize: 12 }}>
                          {formatPhoneDisplay(p.phone) ?? ""}
                        </td>
                        <td style={{ padding: "10px var(--space-3)", maxWidth: 240 }}>
                          <span style={{ display: "block", lineHeight: 1.5, color: MUTED }}>{p.context}</span>
                        </td>
                        <td style={TD}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <span style={auraDotStyle(p.aura, 7)} />
                            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{p.aura}</span>
                          </span>
                        </td>
                        <td style={{ ...TD, fontSize: 12, color: MUTED }}>
                          {dealsSummary(dealsByPerson[p.id] ?? [])}
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
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)" }}>
                <button
                  className="btn btn-ghost"
                  style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                  disabled={busy}
                  onClick={() => addPersonTo(list.id)}
                >
                  + Add person to this list
                </button>
                {hiddenCount > 0 ? (
                  <button
                    className="btn btn-ghost"
                    style={{ height: 32, padding: "0 12px", fontSize: 12, color: MUTED }}
                    onClick={() => setCollapsed((c) => ({ ...c, [list.id]: false }))}
                  >
                    +{hiddenCount} more
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}

        <UnlistedSection
          total={unlistedTotal}
          people={unlistedPeople}
          loading={unlistedLoading}
          open={unlistedOpen}
          lists={lists ?? []}
          busy={busy}
          onToggle={() => setUnlistedOpen((v) => !v)}
          onAddToList={(personId, listId) =>
            run(async () => {
              await addPersonToList(listId, personId);
              setUnlistedPeople((prev) => prev.filter((p) => p.id !== personId));
              setUnlistedTotal((t) => (t !== null ? t - 1 : t));
            })
          }
        />
      </div>

      {open && person ? (
        <PersonCard
          person={person}
          listName={(lists ?? []).find((l) => l.id === open.listId)?.name ?? ""}
          busy={busy}
          spaceId={spaceId}
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

/**
 * Everyone in none of the space's lists. Backed by GET /people?unlisted=true
 * rather than a real list — no reply agent (there's no list to attach one
 * to), and rows offer "add to list" instead of an editable profile card.
 */
function UnlistedSection({
  total,
  people,
  loading,
  open,
  lists,
  busy,
  onToggle,
  onAddToList,
}: {
  total: number | null;
  people: ApiPersonSummary[];
  loading: boolean;
  open: boolean;
  lists: PeopleList[];
  busy: boolean;
  onToggle: () => void;
  onAddToList: (personId: string, listId: string) => void;
}) {
  return (
    <section
      style={{
        border: "1px dashed var(--color-divider)",
        borderRadius: "var(--radius-md)",
        background: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "100%",
          height: 52,
          padding: "0 var(--space-3)",
          background: "none",
          border: "none",
          borderBottom: open ? "1px solid var(--color-divider)" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Chevron open={open} />
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>
          Unlisted
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>Not on any list yet</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>{total ?? "…"}</span>
      </button>

      {open ? (
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <p style={{ margin: 0, padding: "var(--space-3)", fontSize: 13, color: MUTED }}>Loading…</p>
          ) : people.length === 0 ? (
            <p style={{ margin: 0, padding: "var(--space-3)", fontSize: 13, color: MUTED }}>
              Everyone is on a list.
            </p>
          ) : (
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Name", "Surname", "Company", "Email", "Phone", "Aura", ""].map((c) => (
                    <th key={c} style={TH}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                    <td style={TD}>{p.firstName || p.displayName}</td>
                    <td style={TD}>{p.lastName ?? ""}</td>
                    <td style={TD}>{p.company || ""}</td>
                    <td style={TD}>{p.email ?? ""}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 12 }}>
                      {formatPhoneDisplay(p.phone) ?? ""}
                    </td>
                    <td style={TD}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={auraDotStyle(p.aura ?? 0, 7)} />
                        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
                          {p.aura ?? 0}
                        </span>
                      </span>
                    </td>
                    <td style={TD}>
                      <select
                        className="input"
                        disabled={busy || lists.length === 0}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) onAddToList(p.id, e.target.value);
                        }}
                        style={{ height: 30, fontSize: 12, padding: "0 8px" }}
                      >
                        <option value="">Add to list…</option>
                        {lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  );
}

type SendChannel = "whatsapp" | "email" | "sms" | "telegram";

const SEND_CHANNELS: { value: SendChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "telegram", label: "Telegram" },
];

/**
 * Real "Get link" action, replacing the old fake publicProfile slug: creates
 * (or reuses) a public token for this person, then offers to copy it or send
 * it via a channel. Only WhatsApp actually sends today (reusing the same
 * sendWaMessage the org's outreach/reply-agent features already use) —
 * other channels are listed so the picker doesn't need reworking once
 * they're wired up, but say plainly that they aren't yet.
 */
function PublicLinkAction({ personId, spaceId }: { personId: string; spaceId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<SendChannel>("whatsapp");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const getLink = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const { path } = await createPersonPublicLink(personId);
      setUrl(`${window.location.origin}${path}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create link");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied.");
    } catch {
      setStatus(url);
    }
  };

  const send = async () => {
    if (!url || !spaceId || sending) return;
    setSending(true);
    setStatus(null);
    try {
      if (channel !== "whatsapp") {
        setStatus(`Sending via ${SEND_CHANNELS.find((c) => c.value === channel)?.label} isn't configured yet — use Copy link instead.`);
        return;
      }
      const [detail, accounts]: [Awaited<ReturnType<typeof getPersonDetail>>, ApiWaAccount[]] =
        await Promise.all([getPersonDetail(personId), listWaAccounts(spaceId)]);
      const jid = detail.identities.find((i) => i.provider === "whatsapp")?.value;
      if (!jid) {
        setStatus("This person has no WhatsApp identity on file.");
        return;
      }
      const account = accounts[0];
      if (!account) {
        setStatus("No WhatsApp account connected for this org yet.");
        return;
      }
      await sendWaMessage(account.id, jid, `Here's your link: ${url}`);
      setStatus("Sent via WhatsApp.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  if (!url) {
    return (
      <button
        className="btn btn-secondary"
        style={{ justifyContent: "flex-start" }}
        disabled={loading}
        onClick={() => void getLink()}
      >
        {loading ? "Getting link…" : "Get link"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }} onClick={() => void copyLink()}>
        Copy link
      </button>
      <select
        className="input"
        value={channel}
        onChange={(e) => setChannel(e.target.value as SendChannel)}
        style={{ height: 34, fontSize: 13, padding: "0 8px" }}
      >
        {SEND_CHANNELS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        className="btn btn-secondary"
        style={{ justifyContent: "flex-start" }}
        disabled={sending}
        onClick={() => void send()}
      >
        {sending ? "Sending…" : "Send"}
      </button>
      {status ? (
        <span style={{ fontSize: 12, color: MUTED, flexBasis: "100%" }}>{status}</span>
      ) : null}
    </div>
  );
}

/** The mockup's `person-card` modal (lines 485-578), styles verbatim. */
function PersonCard({
  person,
  listName,
  busy,
  spaceId,
  onClose,
  onPatch,
  onRemove,
}: {
  person: PeopleListPerson;
  listName: string;
  busy: boolean;
  spaceId: string | null;
  onClose: () => void;
  onPatch: (fields: Parameters<typeof updatePerson>[1]) => void;
  onRemove: () => void;
}) {
  const onboarded = person.onboarded;
  const readonly: { label: string; value: string }[] = [
    { label: "Name", value: person.firstName || "—" },
    { label: "Surname", value: person.lastName || "—" },
    { label: "Company", value: person.company || "—" },
    { label: "Email", value: person.email || "—" },
    { label: "Phone", value: formatPhoneDisplay(person.phone) || "—" },
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
                <Field label="Company" value={person.company} onSave={(v) => onPatch({ company: v })} />
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
          <PublicLinkAction personId={person.id} spaceId={spaceId} />
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
