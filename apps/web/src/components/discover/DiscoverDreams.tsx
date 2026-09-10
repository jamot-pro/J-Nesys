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

const CATEGORIES = ["All", "Education", "Climate", "Health", "Technology", "Craft", "Community"];

interface DreamCard {
  initials: string;
  name: string;
  holder: string;
  place: string;
  cat: string;
  statement: string;
  believers: number;
  pctText: string;
  agents: number;
  need: string;
  pay: string;
  joined: boolean;
}

const DREAMS: DreamCard[] = [
  {
    initials: "TG",
    name: "Tidal Grid",
    holder: "Mara Jansen",
    place: "Utrecht, Netherlands",
    cat: "Climate",
    statement:
      "Put tidal power on the grid of every small island in the North Sea, owned by the people who live there.",
    believers: 812,
    pctText: "64% funded",
    agents: 6,
    need: "Grid engineers, Dutch translation",
    pay: "€40–90 per task",
    joined: false,
  },
  {
    initials: "OS",
    name: "Open Stitch",
    holder: "Amara Boateng",
    place: "Accra, Ghana",
    cat: "Craft",
    statement: "Train 500 tailors in pattern-drafting and connect them directly to buyers, no middlemen.",
    believers: 341,
    pctText: "38% funded",
    agents: 3,
    need: "Curriculum design, video editing",
    pay: "$25–60 per task",
    joined: true,
  },
  {
    initials: "RH",
    name: "Rural Health Net",
    holder: "Priya Nair",
    place: "Kerala, India",
    cat: "Health",
    statement: "A referral network so a village clinic can reach a specialist in minutes, not weeks.",
    believers: 1204,
    pctText: "81% funded",
    agents: 9,
    need: "Malayalam translation, ops",
    pay: "₹800–2,200 per task",
    joined: false,
  },
  {
    initials: "FL",
    name: "First Language",
    holder: "Kai Whetu",
    place: "Rotorua, New Zealand",
    cat: "Education",
    statement: "Build a spaced-repetition course for Te Reo Māori from oral recordings before they're lost.",
    believers: 567,
    pctText: "52% funded",
    agents: 4,
    need: "Audio transcription, dialect review",
    pay: "$30–70 per task",
    joined: false,
  },
  {
    initials: "GB",
    name: "Grid Bazaar",
    holder: "Tomás Ríos",
    place: "Oaxaca, Mexico",
    cat: "Technology",
    statement: "A peer-to-peer marketplace for surplus solar power between neighboring households.",
    believers: 289,
    pctText: "29% funded",
    agents: 5,
    need: "Firmware, Spanish support",
    pay: "$35–80 per task",
    joined: false,
  },
  {
    initials: "NW",
    name: "Neighbor Watch",
    holder: "Elin Berg",
    place: "Malmö, Sweden",
    cat: "Community",
    statement: "Coordinate volunteer eldercare check-ins across a whole district, agent-scheduled.",
    believers: 178,
    pctText: "22% funded",
    agents: 2,
    need: "Ops coordination, Swedish support",
    pay: "kr 300–650 per task",
    joined: true,
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
