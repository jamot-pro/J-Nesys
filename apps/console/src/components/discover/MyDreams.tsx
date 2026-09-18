"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `my-dreams` region pixel-for-pixel: the
 * Joined / Search / Match / Earnings tabs. No backend concept of joined
 * dreams, per-dream agents, or points/earnings exists yet — this is the
 * mockup's own placeholder content, not real. Buttons are inert.
 */

const TABS = ["Joined", "Search", "Match", "Earnings"] as const;
type Tab = (typeof TABS)[number];

interface JoinedDream {
  id: string;
  name: string;
  role: string;
  agentCount: string;
  open: number;
  points: number;
  earned: string;
  agents: { name: string; task: string; model: string; runs: number; running: boolean }[];
}

/** Copied verbatim from OrgConsole.dc.html's JOINED array. */
const JOINED: JoinedDream[] = [
  {
    id: "tidal",
    name: "Tidal Grid",
    role: "Agent maintainer",
    agentCount: "3 agents",
    open: 3,
    points: 4820,
    earned: "€1,340",
    agents: [
      { name: "Permit Reader", task: "Reads council minutes for objections", model: "Sonnet 4.5", runs: 412, running: true },
      { name: "Grid Scout", task: "Tracks operator offtake terms", model: "Haiku 4.5", runs: 96, running: true },
      { name: "Tide Translator", task: "NL/DA/DE translation of charter docs", model: "Sonnet 4.5", runs: 58, running: false },
    ],
  },
  {
    id: "lumen",
    name: "Lumen Schools",
    role: "Contributor",
    agentCount: "1 agent",
    open: 5,
    points: 1150,
    earned: "€380",
    agents: [
      { name: "Dialect Checker", task: "Flags tutor replies that miss local idiom", model: "Sonnet 4.5", runs: 1204, running: true },
    ],
  },
];

/** Copied verbatim from OrgConsole.dc.html's MY_TASKS array. */
const MY_TASKS = [
  { dream: "Tidal Grid", text: "Review Permit Reader output for the Fanø council minutes.", pay: "€60", pts: 120, due: "Today" },
  { dream: "Tidal Grid", text: "Re-prompt Grid Scout to also capture connection-cost estimates.", pay: "€90", pts: 180, due: "Thu" },
  { dream: "Lumen Schools", text: "Record 20 phrases in Mirandese for the dialect set.", pay: "€45", pts: 90, due: "Fri" },
  { dream: "Lumen Schools", text: "Sanity-check tutor transcripts from Bragança for tone.", pay: "€35", pts: 70, due: "Next week" },
];

const SEARCH_CATEGORIES = ["All", "Energy", "Food", "Education", "Circular", "Cities", "Commerce"];

/** Remaining (un-joined) entries from OrgConsole.dc.html's PUBLIC_DREAMS. */
const SEARCH_RESULTS = [
  { initials: "OS", name: "Open Seed Bank", need: "Agronomists, data entry, field photographers", pay: "€25–€90 / task", believers: "4,870", pctText: "41% funded", joined: false },
  { initials: "R", name: "Reknit", need: "Tailors, logistics planners, pricing analysts", pay: "€20–€75 / task", believers: "918", pctText: "24% funded", joined: false },
  { initials: "QS", name: "Quiet Sky", need: "Sensor builders, night walkers, city lawyers", pay: "€35–€110 / task", believers: "3,406", pctText: "55% funded", joined: false },
  { initials: "FL", name: "Fair Ledger", need: "Field interviewers, supply-chain analysts", pay: "€45–€130 / task", believers: "1,677", pctText: "33% funded", joined: false },
];

/** Mirrors MATCH_OPENING — the mockup only seeds one opening message, not
 * a fabricated back-and-forth. */
const MATCH_CHAT = [
  {
    who: "Jamot",
    isAgent: true,
    text: "Tell me what you are good at and what you care about, and I will point at the dreams that need exactly that.",
  },
];

export function MyDreams() {
  const [tab, setTab] = useState<Tab>("Joined");
  const [selectedId, setSelectedId] = useState(JOINED[0]?.id);
  const [searchCategory, setSearchCategory] = useState("All");
  const [matchDraft, setMatchDraft] = useState("");
  const [query, setQuery] = useState("");

  const selected = JOINED.find((j) => j.id === selectedId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[36px] leading-[1.1] tracking-[-0.02em]">My Dreams</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            {JOINED.length} dreams joined. You maintain the agents; the dream agent hands you the tasks.
          </p>
        </div>
      </div>

      <div className="my-4 flex flex-wrap gap-1 rounded-full bg-background p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              t === tab ? "bg-foreground text-background" : "text-foreground hover:bg-card",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Joined" ? (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex w-[260px] shrink-0 flex-col gap-2">
              {JOINED.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-[var(--radius-md)] border p-3 text-left",
                    j.id === selectedId ? "border-foreground bg-background" : "border-border hover:bg-background",
                  )}
                >
                  <span className="font-display text-[15px] font-extrabold">{j.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {j.role} · {j.agentCount} · {j.open} open tasks
                  </span>
                </button>
              ))}
              <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
                Find another dream
              </button>
            </div>

            <div className="min-w-[300px] flex-1">
              {selected ? (
                <>
                  <div className="flex flex-wrap gap-3">
                    <div className="min-w-[150px] flex-1 rounded-[var(--radius-md)] border border-border px-4 py-3">
                      <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Points here</span>
                      <div className="mt-1 font-display text-[26px] font-extrabold">{selected.points}</div>
                    </div>
                    <div className="min-w-[150px] flex-1 rounded-[var(--radius-md)] border border-border px-4 py-3">
                      <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Earned here</span>
                      <div className="mt-1 font-display text-[26px] font-extrabold">{selected.earned}</div>
                    </div>
                  </div>

                  <h2 className="mt-4 mb-1.5 text-xl">Agents you maintain in {selected.name}</h2>
                  <p className="mb-3 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
                    Your agents run inside this dream&apos;s memory. The dream holder sees their output, not
                    your prompts.
                  </p>
                  <div className="flex flex-col gap-2">
                    {selected.agents.map((a) => (
                      <div
                        key={a.name}
                        className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-border px-4 py-3 shadow-[var(--shadow-sm)]"
                      >
                        <span className="flex min-w-[200px] flex-1 flex-col">
                          <span className="font-display text-[15px] font-bold">{a.name}</span>
                          <span className="text-xs text-muted-foreground">{a.task}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tracking-[0.06em] text-muted-foreground/80 uppercase">
                          {a.model} · {a.runs} runs
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1 text-[11px] tracking-[0.06em] uppercase",
                            a.running ? "bg-background text-accent-ink" : "bg-background text-foreground",
                          )}
                        >
                          {a.running ? "Running" : "Paused"}
                        </span>
                        <button className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm hover:bg-muted">
                          Configure
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
                    Add an agent to this dream
                  </button>
                </>
              ) : (
                <p className="text-[15px] leading-relaxed">
                  You have not joined a dream yet.{" "}
                  <a href="#" className="underline">
                    Browse the ones looking for people.
                  </a>
                </p>
              )}
            </div>
          </div>

          <h2 className="mt-6 mb-1.5 text-xl">Tasks assigned to you</h2>
          <p className="mb-3 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
            Handed out by each dream&apos;s agent. Points build your standing; the money is allocated from
            that dream&apos;s raise.
          </p>
          <div className="flex flex-col gap-2">
            {MY_TASKS.map((t, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-border px-4 py-3 shadow-[var(--shadow-sm)]"
              >
                <span className="w-[110px] shrink-0 text-[11px] tracking-[0.06em] text-accent-ink uppercase">
                  {t.dream}
                </span>
                <span className="min-w-[200px] flex-1 text-sm">{t.text}</span>
                <span className="shrink-0 font-display text-[15px] font-extrabold">{t.pay}</span>
                <span className="w-[120px] shrink-0 text-[11px] tracking-[0.06em] text-muted-foreground/80 uppercase">
                  {t.pts} pts · {t.due}
                </span>
                <button className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm hover:bg-muted">
                  Take
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "Search" ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by skill, place, cause — grid, dialect, tailoring…"
            className="h-10 max-w-[520px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
          />
          <div className="my-3 flex flex-wrap gap-1 rounded-full bg-background p-1" style={{ width: "fit-content" }}>
            {SEARCH_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setSearchCategory(c)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  c === searchCategory ? "bg-foreground text-background" : "text-foreground hover:bg-card",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {SEARCH_RESULTS.map((d) => (
              <div
                key={d.name}
                className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] border border-border px-4 py-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-background font-display text-sm font-extrabold">
                  {d.initials}
                </span>
                <span className="flex min-w-[220px] flex-1 flex-col">
                  <span className="font-display text-base font-extrabold">{d.name}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {d.need} · {d.pay}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tracking-[0.06em] text-muted-foreground/80 uppercase">
                  {d.believers} believers · {d.pctText}
                </span>
                <button className="shrink-0 rounded-[var(--radius-sm)] border border-border px-3.5 py-1.5 text-sm hover:bg-muted">
                  Join
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "Match" ? (
        <div className="max-w-[640px] rounded-[var(--radius-md)] border border-border p-4">
          <span className="text-[10px] tracking-[0.1em] text-accent-ink uppercase">Dream matchmaker</span>
          <p className="mt-1.5 mb-3 text-[13px] leading-relaxed text-muted-foreground">
            Reads your profile, your skills and what you have already worked on, then suggests dreams that
            need it.
          </p>
          <div className="flex max-h-[340px] min-h-[200px] flex-col gap-2.5 overflow-y-auto rounded-[var(--radius-md)] bg-background p-3">
            {MATCH_CHAT.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-0.5", m.isAgent ? "items-start" : "items-end")}>
                <span className="text-[9px] tracking-[0.1em] text-muted-foreground/80 uppercase">{m.who}</span>
                <span
                  className={cn(
                    "max-w-[88%] rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] leading-relaxed",
                    m.isAgent ? "bg-card" : "bg-foreground text-background",
                  )}
                >
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={matchDraft}
              onChange={(e) => setMatchDraft(e.target.value)}
              placeholder="I am a translator and I care about education…"
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
            />
            <button className="shrink-0 rounded-[var(--radius-sm)] border border-border px-3.5 text-sm hover:bg-muted">
              Send
            </button>
          </div>
        </div>
      ) : null}

      {tab === "Earnings" ? (
        <>
          <div className="flex max-w-[640px] flex-wrap gap-3">
            <div className="min-w-[180px] flex-1 rounded-[var(--radius-md)] border border-border p-4">
              <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Total points</span>
              <div className="mt-1 font-display text-[34px] font-extrabold">
                {JOINED.reduce((sum, j) => sum + j.points, 0)}
              </div>
            </div>
            <div className="min-w-[180px] flex-1 rounded-[var(--radius-md)] border border-border p-4">
              <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Paid out</span>
              <div className="mt-1 font-display text-[34px] font-extrabold">
                €{JOINED.reduce((sum, j) => sum + Number(j.earned.replace(/[^0-9]/g, "")), 0).toLocaleString("en-US")}
              </div>
            </div>
          </div>
          <h2 className="mt-6 mb-3 text-xl">Per dream</h2>
          <div className="flex max-w-[640px] flex-col gap-2">
            {JOINED.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-4 rounded-[var(--radius-md)] border border-border px-4 py-3"
              >
                <span className="flex-1 font-display text-[15px] font-bold">{j.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{j.role}</span>
                <button className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm hover:bg-muted">
                  Leave
                </button>
              </div>
            ))}
          </div>
          <button className="mt-4 flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
            Withdraw earnings
          </button>
        </>
      ) : null}
    </div>
  );
}
