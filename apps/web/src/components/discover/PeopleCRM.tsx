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
  auraColor: string;
  channels: string[];
  onboarded: boolean;
}

const PEOPLE: PersonRow[] = [
  {
    id: "p1", name: "Mara", surname: "Jansen", email: "mara@tidalgrid.org", phone: "+31 6 1234 5678",
    website: "tidalgrid.org", pid: "prof_a91f", hasProfile: true, profileLink: "jamot.pro/mara",
    context: "Grid engineer, holds Tidal Grid. Prefers async, replies fastest on WhatsApp.",
    aura: 812, auraColor: "#ff2657", channels: ["WA", "@"], onboarded: true,
  },
  {
    id: "p2", name: "Amara", surname: "Boateng", email: "amara@openstitch.org", phone: "+233 55 123 4567",
    website: "openstitch.org", pid: "prof_2c7e", hasProfile: true, profileLink: "jamot.pro/amara",
    context: "Curriculum lead for Open Stitch. Reviews patterns weekly.", aura: 341, auraColor: "#0ea5e9",
    channels: ["TG"], onboarded: true,
  },
  {
    id: "p3", name: "Kai", surname: "Whetu", email: "kai@firstlanguage.nz", phone: "+64 21 555 0110",
    website: "", pid: "", hasProfile: false, profileLink: "", context: "Native speaker, audio archive contact.",
    aura: 0, auraColor: "#9b9797", channels: ["@"], onboarded: false,
  },
];

interface PersonList {
  id: string;
  name: string;
  people: PersonRow[];
  open: boolean;
}

function AuraDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function PeopleCRM() {
  const [lists, setLists] = useState<PersonList[]>([
    { id: "l1", name: "All people", people: PEOPLE, open: true },
    { id: "l2", name: "Tidal Grid believers", people: [PEOPLE[0]!], open: false },
  ]);
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
                              <AuraDot color={p.auraColor} />
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
                                  {ch}
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
                  <AuraDot color={openPersonData.auraColor} size={10} />
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
