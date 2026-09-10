"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, Clock, MessageSquare, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `task-board` region pixel-for-pixel: kanban
 * columns + the card detail modal. Placeholder content — not wired to the
 * real Tasks backend yet.
 */

interface Label {
  text: string;
  color: string;
}

interface Actor {
  mono: string;
  color: string;
  title: string;
}

interface Card {
  id: string;
  labels: Label[];
  title: string;
  due?: string;
  checkLabel?: string;
  actors: Actor[];
}

interface Column {
  id: string;
  name: string;
  cards: Card[];
}

const INITIAL_COLUMNS: Column[] = [
  {
    id: "c1",
    name: "To do",
    cards: [
      { id: "k1", labels: [{ text: "Grid", color: "#ff2657" }], title: "Confirm Vlieland municipal filing", due: "in 2 days", checkLabel: "0/3", actors: [{ mono: "MJ", color: "#ff2657", title: "Mara Jansen" }] },
      { id: "k2", labels: [{ text: "Translation", color: "#0ea5e9" }], title: "Translate grid-connection request #118", due: "in 4 days", actors: [{ mono: "AI", color: "#605d5d", title: "Translator agent" }] },
    ],
  },
  {
    id: "c2",
    name: "In progress",
    cards: [
      { id: "k3", labels: [{ text: "QA", color: "#10b981" }], title: "Score week-3 pattern submissions", checkLabel: "8/12", actors: [{ mono: "AB", color: "#0ea5e9", title: "Amara Boateng" }] },
    ],
  },
  {
    id: "c3",
    name: "Blocked",
    cards: [],
  },
  {
    id: "c4",
    name: "Done",
    cards: [
      { id: "k4", labels: [{ text: "Ops", color: "#8b5cf6" }], title: "Set up firmware CI pipeline", actors: [{ mono: "TR", color: "#8b5cf6", title: "Tomás Ríos" }, { mono: "AI", color: "#605d5d", title: "Build agent" }] },
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
            {showDone ? "Hide done" : "Show done"}
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
                        key={lb.text}
                        style={{ background: lb.color }}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] text-white uppercase"
                      >
                        {lb.text}
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
                    {k.checkLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-[11px]" />
                        {k.checkLabel}
                      </span>
                    ) : null}
                    <span className="ml-auto flex gap-1">
                      {k.actors.map((a, i) => (
                        <span
                          key={i}
                          title={a.title}
                          style={{ background: a.color }}
                          className="flex size-5 items-center justify-center rounded-full font-mono text-[9px] font-bold text-white"
                        >
                          {a.mono}
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
                      ? { ...c, cards: [...c.cards, { id: `k${Date.now()}`, labels: [], title: "New card", actors: [] }] }
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
                      <span style={{ background: a.color }} className="flex size-4 items-center justify-center rounded-full font-mono text-white">
                        {a.mono}
                      </span>
                      {a.title}
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
                  <span className="text-xs text-muted-foreground">{card.checkLabel ?? "0/0"}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" />
                    Confirm filing with municipality
                  </label>
                  <input
                    placeholder="Add checklist item, press Enter"
                    className="h-[34px] rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
                  />
                </div>
              </div>
              <div>
                <span className="font-display text-xs font-extrabold tracking-[0.1em] uppercase">Activity</span>
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex gap-2.5 text-[13px] leading-relaxed">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-space-accent font-mono text-[10px] text-white">
                      <MessageSquare className="size-3" />
                    </span>
                    <span>
                      <span className="font-semibold">Mara Jansen</span> moved this to In progress.
                    </span>
                  </div>
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
