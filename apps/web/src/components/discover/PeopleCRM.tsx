"use client";

import { useState } from "react";
import { ChevronRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `people-crm` + `person-card` regions
 * pixel-for-pixel. Placeholder content — not wired to the real People
 * backend yet.
 */

const COLUMNS = ["Surname", "Email", "Phone", "Website", "Profile ID", "Profile", "Context", "Aura", "Channels"];

interface PersonRow {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  website: string;
  pid: string;
  hasProfile: boolean;
  profileLink: string;
  context: string;
  aura: number;
  channels: string[];
  onboarded: boolean;
}

/** 2-letter channel codes — copied verbatim from OrgConsole.dc.html's
 * CHANNEL_MONO map. */
const CHANNEL_MONO: Record<string, string> = {
  Email: "em",
  WhatsApp: "wa",
  LinkedIn: "in",
  Telegram: "tg",
  Voice: "vo",
  SMS: "sm",
};

interface PersonList {
  id: string;
  name: string;
  people: PersonRow[];
  open: boolean;
}

/** Copied verbatim from OrgConsole.dc.html's PEOPLE_LISTS array. */
const PEOPLE_LISTS: PersonList[] = [
  {
    id: "l1",
    name: "Operators — Benelux",
    open: true,
    people: [
      {
        id: "p1", name: "Mara", surname: "Jansen", email: "mara@northbound.co", phone: "+31 6 2244 8100",
        website: "jamot.pro", pid: "JM-0001", hasProfile: true, profileLink: "jamot.pro/mara",
        context: "Runs ops for a 40-person logistics collective. Wants agents that draft SOPs she can edit.",
        aura: 78, channels: ["Email", "WhatsApp", "LinkedIn"], onboarded: true,
      },
      {
        id: "p2", name: "Tomas", surname: "de Wit", email: "tomas@havenlink.nl", phone: "+31 6 1180 4472",
        website: "havenlink.nl", pid: "JM-0014", hasProfile: false, profileLink: "",
        context: "Port scheduling. Referred by Mara, no profile generated yet.",
        aura: 41, channels: ["Email", "Telegram"], onboarded: false,
      },
      {
        id: "p3", name: "Ines", surname: "Moreau", email: "ines@atelier-mo.be", phone: "+32 471 22 09 55",
        website: "atelier-mo.be", pid: "JM-0022", hasProfile: true, profileLink: "jamot.pro/ines",
        context: "Independent designer, buys outcome-priced research runs.",
        aura: 63, channels: ["Email", "Voice"], onboarded: true,
      },
    ],
  },
  {
    id: "l2",
    name: "Pilot candidates",
    open: true,
    people: [
      {
        id: "p4", name: "Ruben", surname: "Alvarez", email: "ruben@cargofold.es", phone: "+34 611 908 244",
        website: "cargofold.es", pid: "JM-0031", hasProfile: false, profileLink: "",
        context: "Asked for a paid pilot in Q4. Needs an onboarding link.",
        aura: 29, channels: ["Email", "SMS"], onboarded: false,
      },
      {
        id: "p5", name: "Saoirse", surname: "Byrne", email: "saoirse@loopyard.ie", phone: "+353 87 552 1180",
        website: "loopyard.ie", pid: "JM-0037", hasProfile: true, profileLink: "jamot.pro/saoirse",
        context: "Two agents already active on her account. High response rate.",
        aura: 86, channels: ["Email", "WhatsApp"], onboarded: true,
      },
    ],
  },
];

function AuraDot({ size = 8 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full bg-space-accent"
      style={{ width: size, height: size }}
    />
  );
}

export function PeopleCRM() {
  const [lists, setLists] = useState<PersonList[]>(PEOPLE_LISTS);
  const [openPerson, setOpenPerson] = useState<{ listId: string; personId: string } | null>(null);

  const toggleList = (id: string) =>
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, open: !l.open } : l)));
  const renameList = (id: string, name: string) =>
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  const removeList = (id: string) => setLists((prev) => prev.filter((l) => l.id !== id));

  const openPersonData =
    openPerson &&
    lists.find((l) => l.id === openPerson.listId)?.people.find((p) => p.id === openPerson.personId);
  const openPersonList = openPerson && lists.find((l) => l.id === openPerson.listId);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[36px] leading-[1.1] tracking-[-0.02em]">People</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            The database of Humans interacting with your dream
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
            New person
          </button>
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
            New list
          </button>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex flex-col gap-4">
        {lists.map((L) => (
          <section
            key={L.id}
            className="overflow-hidden rounded-[var(--radius-md)] border border-border shadow-[var(--shadow-sm)]"
          >
            <header className="flex h-[52px] items-center gap-3 border-b border-border px-3">
              <button
                onClick={() => toggleList(L.id)}
                title={L.open ? "Collapse" : "Expand"}
                className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
              >
                <ChevronRight className={cn("size-4 transition-transform", L.open && "rotate-90")} />
              </button>
              <input
                value={L.name}
                onChange={(e) => renameList(L.id, e.target.value)}
                aria-label="List name"
                className="h-[34px] max-w-[340px] min-w-0 flex-1 rounded-[var(--radius-sm)] border border-transparent bg-transparent font-display text-[15px] font-extrabold hover:border-border focus:border-foreground focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">{L.people.length}</span>
              <button
                onClick={() => removeList(L.id)}
                title="Delete list"
                className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
              >
                <Trash2 className="size-4" />
              </button>
            </header>

            {L.open ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="border-b border-border bg-background px-3 py-2.5 text-left font-display text-[10px] font-extrabold tracking-[0.1em] text-muted-foreground uppercase">
                          Name
                        </th>
                        {COLUMNS.map((c) => (
                          <th
                            key={c}
                            className="border-b border-border bg-background px-3 py-2.5 text-left font-display text-[10px] font-extrabold tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {L.people.map((p) => (
                        <tr key={p.id} className="border-b border-border hover:bg-background">
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={() => setOpenPerson({ listId: L.id, personId: p.id })}
                              title="Open profile card"
                              className="font-semibold hover:underline"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{p.surname}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <a href="#" className="no-underline">
                              {p.email}
                            </a>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{p.phone}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {p.website ? (
                              <a href="#" className="no-underline">
                                {p.website}
                              </a>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                            {p.pid}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {p.hasProfile ? (
                              <a href="#" className="font-mono text-xs no-underline">
                                {p.profileLink}
                              </a>
                            ) : (
                              <button className="h-[30px] rounded-[var(--radius-sm)] border border-border px-3 text-xs hover:bg-muted">
                                Onboard
                              </button>
                            )}
                          </td>
                          <td className="max-w-[280px] px-3 py-2.5">
                            <span className="block leading-relaxed text-muted-foreground">{p.context}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <AuraDot />
                              <span className="font-display font-extrabold">{p.aura}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="flex gap-1.5">
                              {p.channels.map((ch) => (
                                <span
                                  key={ch}
                                  title={ch}
                                  className="flex size-6 items-center justify-center rounded-full border border-border font-display text-[10px] font-extrabold"
                                >
                                  {CHANNEL_MONO[ch] ?? ch}
                                </span>
                              ))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3">
                  <button className="h-8 rounded-[var(--radius-sm)] px-3 text-xs hover:bg-muted">
                    + Add person to this list
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ))}
      </div>

      {openPersonData && openPersonList ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center p-8"
          style={{ background: "color-mix(in srgb, #201e1d 32%, transparent)" }}
          onClick={() => setOpenPerson(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-lg)]"
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
              <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold">
                {openPersonData.name} {openPersonData.surname}
              </span>
              <span className="shrink-0 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                {openPersonList.name}
              </span>
              <button
                onClick={() => setOpenPerson(null)}
                title="Close"
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-background px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-white uppercase",
                  )}
                  style={{ background: openPersonData.onboarded ? "oklch(0.45 0.13 150)" : "oklch(0.45 0.13 60)" }}
                >
                  {openPersonData.onboarded ? "Onboarded" : "Not onboarded"}
                </span>
                <span className="min-w-[180px] flex-1 text-xs leading-relaxed text-muted-foreground">
                  {openPersonData.onboarded
                    ? "This person owns and maintains this profile."
                    : "Draft profile — send an onboarding link so they can claim it."}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AuraDot size={10} />
                  <span className="font-display text-[15px] font-extrabold">{openPersonData.aura}</span>
                  <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Aura</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Name", value: openPersonData.name },
                  { label: "Surname", value: openPersonData.surname },
                  { label: "Email", value: openPersonData.email },
                  { label: "Phone", value: openPersonData.phone },
                  { label: "Website", value: openPersonData.website || "—" },
                  { label: "Profile ID", value: openPersonData.pid || "—" },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{r.label}</span>
                    <span className="text-[13px] leading-relaxed">{r.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <span className="font-display text-[11px] font-extrabold tracking-[0.1em] uppercase">Notes</span>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 border-b border-border pb-2 text-[13px] leading-relaxed">
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">2 days ago</span>
                    <span className="min-w-0 flex-1">Confirmed availability for next sprint.</span>
                  </div>
                  <input
                    placeholder="Write a note, press Enter"
                    className="h-[34px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
              <button
                onClick={() => setOpenPerson(null)}
                className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90"
              >
                Save and close
              </button>
              {openPersonData.onboarded ? (
                <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
                  View public profile
                </button>
              ) : (
                <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
                  Send onboarding link
                </button>
              )}
              <button className="ml-auto flex h-10 items-center justify-start rounded-[var(--radius-sm)] px-4 text-sm hover:bg-muted">
                Remove from list
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
