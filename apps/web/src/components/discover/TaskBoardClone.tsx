"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, Clock, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `task-board` region pixel-for-pixel: kanban
 * columns + the card detail modal. Placeholder content — not wired to the
 * real Tasks backend yet.
 */

type ActorKind = "human" | "agent" | "robot";

interface Actor {
  name: string;
  kind: ActorKind;
}

interface ChecklistItem {
  text: string;
  done: boolean;
}

interface Card {
  id: string;
  labels: string[];
  title: string;
  desc: string;
  due?: string;
  checklist: ChecklistItem[];
  actors: Actor[];
  comments: { who: string; kind: ActorKind; text: string }[];
}

interface Column {
  id: string;
  name: string;
  cards: Card[];
}

/** Fixed per-kind monogram/color — copied verbatim from OrgConsole.dc.html's
 * ACTOR_KINDS map (actor color depends on kind, not on the individual). */
const ACTOR_KINDS: Record<ActorKind, { mono: string; bg: string }> = {
  human: { mono: "hu", bg: "oklch(0.42 0.02 60)" },
  agent: { mono: "ag", bg: "oklch(0.44 0.15 265)" },
  robot: { mono: "ro", bg: "oklch(0.42 0.12 155)" },
};

/** Label background hues cycle through this list, by first-seen index —
 * copied verbatim from OrgConsole.dc.html's LABEL_HUES. */
const LABEL_HUES = [25, 60, 145, 210, 300];
const labelHueIndex = new Map<string, number>();
function labelColor(text: string): string {
  if (!labelHueIndex.has(text)) labelHueIndex.set(text, labelHueIndex.size % LABEL_HUES.length);
  return `oklch(0.5 0.13 ${LABEL_HUES[labelHueIndex.get(text)!]})`;
}

/** Copied verbatim from OrgConsole.dc.html's BOARD array. */
const INITIAL_COLUMNS: Column[] = [
  {
    id: "c1",
    name: "Intake",
    cards: [
      {
        id: "k1", labels: ["pilot"], title: "Qualify inbound from Ruben Alvarez",
        desc: "Asked for a paid pilot in Q4. Decide scope before the call.", due: "2026-09-14",
        checklist: [{ text: "Read his last three messages", done: true }, { text: "Draft scope options", done: false }],
        actors: [{ name: "Research agent", kind: "agent" }], comments: [],
      },
      {
        id: "k2", labels: ["recurring"], title: "Weekly logistics digest",
        desc: "Recurring — every Monday 07:00.", checklist: [],
        actors: [{ name: "Research agent", kind: "agent" }],
        comments: [{ who: "Research agent", kind: "agent", text: "ran 6 sources, 2 flagged as paywalled." }],
      },
    ],
  },
  {
    id: "c2",
    name: "Assigned",
    cards: [
      {
        id: "k3", labels: ["sop", "benelux"], title: "Rewrite port SOP for Havenlink",
        desc: "Tomas needs an editable draft, not a final.", due: "2026-09-10",
        checklist: [{ text: "Pull current SOP", done: true }, { text: "Draft v2", done: true }, { text: "Human sign-off", done: false }],
        actors: [{ name: "Mara Jansen", kind: "human" }, { name: "Drafting agent", kind: "agent" }], comments: [],
      },
    ],
  },
  {
    id: "c3",
    name: "In progress",
    cards: [
      {
        id: "k4", labels: ["warehouse"], title: "Cycle-count sweep, aisle 4–9",
        desc: "Physical count executed on site.", due: "2026-09-08",
        checklist: [{ text: "Aisles 4–6", done: true }, { text: "Aisles 7–9", done: false }],
        actors: [{ name: "Unit R-02", kind: "robot" }],
        comments: [{ who: "Unit R-02", kind: "robot", text: "aisle 6 blocked, resumed at 04:12." }],
      },
    ],
  },
  {
    id: "c4",
    name: "Done",
    cards: [
      {
        id: "k5", labels: ["onboarding"], title: "Onboard Saoirse Byrne",
        desc: "Profile generated, two agents active.",
        checklist: [{ text: "Send link", done: true }, { text: "Confirm aura sync", done: true }],
        actors: [{ name: "Mara Jansen", kind: "human" }], comments: [],
      },
    ],
  },
];

export function TaskBoardClone() {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [showDone, setShowDone] = useState(true);
  const [openCard, setOpenCard] = useState<{ columnId: string; cardId: string } | null>(null);

  const renameColumn = (id: string, name: string) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  const removeColumn = (id: string) => setColumns((prev) => prev.filter((c) => c.id !== id));
  const moveCard = (columnId: string, cardId: string, dir: -1 | 1) => {
    setColumns((prev) => {
      const colIndex = prev.findIndex((c) => c.id === columnId);
      const targetIndex = colIndex + dir;
      if (colIndex === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const card = prev[colIndex]!.cards.find((k) => k.id === cardId);
      if (!card) return prev;
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      next[colIndex]!.cards = next[colIndex]!.cards.filter((k) => k.id !== cardId);
      next[targetIndex]!.cards.push(card);
      return next;
    });
  };

  const visibleColumns = showDone ? columns : columns.filter((c) => c.name !== "Done");
  const card =
    openCard &&
    columns.find((c) => c.id === openCard.columnId)?.cards.find((k) => k.id === openCard.cardId);
  const cardColumn = openCard && columns.find((c) => c.id === openCard.columnId);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[36px] leading-[1.1] tracking-[-0.02em]">Task Manager</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            One board per workflow. Every card can be assigned to actors — humans, agents or robots — and
            moves through the columns as they work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted"
          >
            {showDone ? "Hide done column" : "Show done column"}
          </button>
          <button
            onClick={() =>
              setColumns((prev) => [...prev, { id: `c${Date.now()}`, name: "New column", cards: [] }])
            }
            className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90"
          >
            New column
          </button>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {visibleColumns.map((C) => (
          <section key={C.id} className="flex w-[296px] shrink-0 flex-col gap-3 rounded-[var(--radius-md)] bg-background p-3">
            <header className="flex items-center gap-2">
              <input
                value={C.name}
                onChange={(e) => renameColumn(C.id, e.target.value)}
                aria-label="Column name"
                className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-transparent bg-transparent font-display text-sm font-extrabold hover:border-border focus:border-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground">{C.cards.length}</span>
              <button
                onClick={() => removeColumn(C.id)}
                title="Delete column"
                className="flex size-[26px] items-center justify-center rounded-[var(--radius-sm)] hover:bg-card"
              >
                <Trash2 className="size-3.5" />
              </button>
            </header>

            <div className="flex flex-col gap-2">
              {C.cards.map((k) => (
                <article
                  key={k.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-border bg-card p-2.5 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex flex-wrap gap-1">
                    {k.labels.map((lb) => (
                      <span
                        key={lb}
                        style={{ background: labelColor(lb) }}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-white uppercase"
                      >
                        {lb}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setOpenCard({ columnId: C.id, cardId: k.id })}
                    className="text-left text-[13px] leading-snug font-semibold hover:underline"
                  >
                    {k.title}
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {k.due ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5">
                        <Clock className="size-[11px]" />
                        {k.due}
                      </span>
                    ) : null}
                    {k.checklist.length > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-[11px]" />
                        {k.checklist.filter((c) => c.done).length}/{k.checklist.length}
                      </span>
                    ) : null}
                    {k.comments.length > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-[11px]" />
                        {k.comments.length}
                      </span>
                    ) : null}
                    <span className="ml-auto flex gap-1">
                      {k.actors.map((a, i) => (
                        <span
                          key={i}
                          title={a.name}
                          style={{ background: ACTOR_KINDS[a.kind].bg }}
                          className="flex size-5 items-center justify-center rounded-full font-mono text-[9px] font-bold text-white"
                        >
                          {ACTOR_KINDS[a.kind].mono}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveCard(C.id, k.id, -1)}
                      title="Move left"
                      className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveCard(C.id, k.id, 1)}
                      title="Move right"
                      className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
                    >
                      →
                    </button>
                    <button title="Archive card" className="ml-auto flex size-6 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background">
                      <Archive className="size-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <button
              onClick={() =>
                setColumns((prev) =>
                  prev.map((c) =>
                    c.id === C.id
                      ? { ...c, cards: [...c.cards, { id: `k${Date.now()}`, labels: [], title: "New card", desc: "", checklist: [], actors: [], comments: [] }] }
                      : c,
                  ),
                )
              }
              className="flex h-8 items-center justify-start rounded-[var(--radius-sm)] px-2.5 text-xs hover:bg-card"
            >
              + Add card
            </button>
          </section>
        ))}
      </div>

      {card && cardColumn ? (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto p-8"
          style={{ background: "color-mix(in srgb, #201e1d 34%, transparent)" }}
          onClick={() => setOpenCard(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto max-w-[620px] overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-lg)]"
          >
            <div className="flex h-[52px] items-center gap-3 border-b border-border px-4">
              <span className="text-[10px] tracking-[0.1em] text-accent-ink uppercase">{cardColumn.name}</span>
              <button
                onClick={() => setOpenCard(null)}
                title="Close card"
                className="ml-auto flex size-8 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
              >
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <input
                defaultValue={card.title}
                aria-label="Card title"
                className="h-11 rounded-[var(--radius-sm)] border border-transparent bg-transparent font-display text-xl font-extrabold hover:border-border focus:border-foreground focus:outline-none"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  rows={3}
                  defaultValue={card.desc}
                  className="rounded-[var(--radius-sm)] border border-border bg-background p-2.5 text-sm outline-none focus:border-space-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Due date</label>
                  <input type="date" className="h-10 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Labels</label>
                  <input placeholder="Add label, press Enter" className="h-10 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent" />
                </div>
              </div>
              <div>
                <span className="font-display text-xs font-extrabold tracking-[0.1em] uppercase">Actors</span>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Who does the work — a person from People, an agent, or a robot.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.actors.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-full bg-background py-1 pr-2 pl-2.5 text-xs">
                      <span style={{ background: ACTOR_KINDS[a.kind].bg }} className="flex size-4 items-center justify-center rounded-full font-mono text-white">
                        {ACTOR_KINDS[a.kind].mono}
                      </span>
                      {a.name}
                      <button title="Unassign" className="flex size-[17px] items-center justify-center rounded-full hover:bg-card">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="h-8 rounded-[var(--radius-sm)] px-3 text-xs hover:bg-muted">+ Person</button>
                  <button className="h-8 rounded-[var(--radius-sm)] px-3 text-xs hover:bg-muted">+ Agent</button>
                  <button className="h-8 rounded-[var(--radius-sm)] px-3 text-xs hover:bg-muted">+ Robot</button>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xs font-extrabold tracking-[0.1em] uppercase">Checklist</span>
                  <span className="text-xs text-muted-foreground">
                    {card.checklist.filter((c) => c.done).length}/{card.checklist.length}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {card.checklist.map((item, i) => (
                    <label key={i} className="flex items-center gap-2 text-[13px]">
                      <input type="checkbox" defaultChecked={item.done} />
                      {item.text}
                    </label>
                  ))}
                  <input
                    placeholder="Add checklist item, press Enter"
                    className="h-[34px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
                  />
                </div>
              </div>
              <div>
                <span className="font-display text-xs font-extrabold tracking-[0.1em] uppercase">Activity</span>
                <div className="mt-3 flex flex-col gap-2.5">
                  {card.comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    card.comments.map((c, i) => (
                      <div key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                        <span
                          style={{ background: ACTOR_KINDS[c.kind].bg }}
                          className="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-white"
                        >
                          {ACTOR_KINDS[c.kind].mono}
                        </span>
                        <span>
                          <span className="font-semibold">{c.who}</span> {c.text}
                        </span>
                      </div>
                    ))
                  )}
                  <input
                    placeholder="Write a comment, press Enter"
                    className="h-[34px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOpenCard(null)}
                  className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90"
                >
                  Save and close
                </button>
                <button className="flex h-10 items-center gap-1.5 justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
                  <ArchiveRestore className="size-4" />
                  Archive card
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
