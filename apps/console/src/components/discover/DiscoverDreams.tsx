"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `discover-dreams` region pixel-for-pixel.
 * There is no backend concept of a public dream marketplace (believers,
 * funding %, per-task pay) yet — this content is the mockup's own
 * placeholder data, not real. Join/search are inert until that backend
 * exists.
 */

const CATEGORIES = ["All", "Energy", "Food", "Education", "Circular", "Cities", "Commerce"];

interface DreamCard {
  initials: string;
  name: string;
  holder: string;
  place: string;
  cat: string;
  statement: string;
  believers: string;
  pctText: string;
  agents: string;
  need: string;
  pay: string;
  joined: boolean;
}

/** Copied verbatim from OrgConsole.dc.html's PUBLIC_DREAMS array. `joined`
 * mirrors its JOINED array (ids: tidal, lumen). */
const DREAMS: DreamCard[] = [
  {
    initials: "TG",
    name: "Tidal Grid",
    holder: "Mara Jansen",
    place: "Utrecht",
    cat: "Energy",
    statement: "Put tidal power on the grid of every small island in the North Sea, owned by the people who live there.",
    believers: "1,232",
    pctText: "62% funded",
    agents: "14",
    need: "Grid analysts, translators, permit readers",
    pay: "€40–€120 / task",
    joined: true,
  },
  {
    initials: "OS",
    name: "Open Seed Bank",
    holder: "Ifeoma Adeyemi",
    place: "Lagos",
    cat: "Food",
    statement: "A public, free seed library for every climate zone in West Africa, with agents that match seeds to soil.",
    believers: "4,870",
    pctText: "41% funded",
    agents: "31",
    need: "Agronomists, data entry, field photographers",
    pay: "€25–€90 / task",
    joined: false,
  },
  {
    initials: "LS",
    name: "Lumen Schools",
    holder: "Diego Ferraz",
    place: "Porto",
    cat: "Education",
    statement: "Every rural school in Portugal gets a tutor agent that speaks the local dialect and never gives up on a student.",
    believers: "2,104",
    pctText: "78% funded",
    agents: "22",
    need: "Teachers, dialect speakers, curriculum reviewers",
    pay: "€30–€150 / task",
    joined: true,
  },
  {
    initials: "R",
    name: "Reknit",
    holder: "Hanna Vogel",
    place: "Leipzig",
    cat: "Circular",
    statement: "Make repairing a garment cheaper than replacing it, in every European city, by 2030.",
    believers: "918",
    pctText: "24% funded",
    agents: "9",
    need: "Tailors, logistics planners, pricing analysts",
    pay: "€20–€75 / task",
    joined: false,
  },
  {
    initials: "QS",
    name: "Quiet Sky",
    holder: "Ravi Menon",
    place: "Bengaluru",
    cat: "Cities",
    statement: "Measure night noise on every street of one city, then hand the map to the people who can change it.",
    believers: "3,406",
    pctText: "55% funded",
    agents: "18",
    need: "Sensor builders, night walkers, city lawyers",
    pay: "€35–€110 / task",
    joined: false,
  },
  {
    initials: "FL",
    name: "Fair Ledger",
    holder: "Amara Osei",
    place: "Accra",
    cat: "Commerce",
    statement: "Every cocoa farmer sees the final shelf price of their own beans, and can act on it.",
    believers: "1,677",
    pctText: "33% funded",
    agents: "12",
    need: "Field interviewers, supply-chain analysts",
    pay: "€45–€130 / task",
    joined: false,
  },
];

export function DiscoverDreams() {
  const [category, setCategory] = useState("All");

  const filtered = DREAMS.filter((d) => category === "All" || d.cat === category);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <span className="text-[10px] tracking-[0.1em] text-accent-ink uppercase">Discover</span>
          <h1 className="mt-1.5 text-4xl leading-[1.05] tracking-[-0.02em]">Dreams looking for people.</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
            Every dream published on Jamot. Join one and it appears in your rail — then you can build and
            maintain the agents that make it real, and get paid per task.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm font-medium hover:bg-muted">
            Search dreams
          </button>
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
            Ask AI what fits me
          </button>
        </div>
      </div>

      <div className="my-4 flex flex-wrap gap-1 rounded-full bg-background p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              c === category ? "bg-foreground text-background" : "text-foreground hover:bg-card",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {filtered.map((d) => (
          <div
            key={d.name}
            className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border p-4 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-background font-display text-[15px] font-extrabold">
                {d.initials}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-[17px] leading-tight font-extrabold">{d.name}</span>
                <span className="text-xs text-muted-foreground">
                  {d.holder} · {d.place} · {d.cat}
                </span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">{d.statement}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>{d.believers} believers</span>
              <span>{d.pctText}</span>
              <span>{d.agents} agents</span>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-background px-3 py-2 text-xs leading-relaxed">
              <span className="tracking-[0.08em] text-muted-foreground uppercase">Needs</span> {d.need} ·{" "}
              <span className="text-accent-ink">{d.pay}</span>
            </div>
            <div className="mt-auto flex gap-2">
              {d.joined ? (
                <button className="flex h-9 items-center justify-start rounded-[var(--radius-sm)] border border-border px-3.5 text-sm hover:bg-muted">
                  Open — joined
                </button>
              ) : (
                <button className="flex h-9 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-3.5 text-sm font-medium text-space-accent-foreground hover:opacity-90">
                  Join this dream
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dream matches that yet.</p>
      ) : null}
    </div>
  );
}
