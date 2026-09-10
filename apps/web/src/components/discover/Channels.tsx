"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `channels` region pixel-for-pixel: channel
 * chips, a thread list, and a message view. Placeholder content — real
 * channel/thread data isn't wired up here yet.
 */

interface Msg {
  who: string;
  out: boolean;
  text: string;
  time: string;
}

interface Thread {
  id: string;
  ch: string;
  name: string;
  group: boolean;
  members: number;
  time: string;
  unread: number;
  msgs: Msg[];
}

/** Copied verbatim from OrgConsole.dc.html's CHANNELS array. */
const CHANNEL_CHIPS = [
  { id: "tg", name: "Telegram", mono: "tg", hue: 235 },
  { id: "wa", name: "WhatsApp", mono: "wa", hue: 150 },
  { id: "dc", name: "Discord", mono: "dc", hue: 275 },
  { id: "gc", name: "Google Chat", mono: "gc", hue: 130 },
  { id: "sl", name: "Slack", mono: "sl", hue: 330 },
  { id: "bz", name: "Buzz", mono: "bz", hue: 45 },
];
function channelColor(hue: number): string {
  return `oklch(0.55 0.14 ${hue})`;
}

/** Copied verbatim from OrgConsole.dc.html's THREADS array. */
const THREADS: Thread[] = [
  {
    id: "t1", ch: "tg", name: "Havenlink ops", group: true, members: 6, unread: 3, time: "09:41",
    msgs: [
      { who: "Tomas de Wit", out: false, text: "Aisle 6 is blocked again — can the sweep be rescheduled?", time: "09:32" },
      { who: "Drafting agent", out: false, text: "SOP v2 is drafted and waiting for your sign-off.", time: "09:35" },
      { who: "Mara Jansen", out: true, text: "Looking at it now. Keep the sweep, I will clear the aisle.", time: "09:41" },
    ],
  },
  {
    id: "t2", ch: "tg", name: "Ruben Alvarez", group: false, members: 2, unread: 1, time: "08:12",
    msgs: [{ who: "Ruben Alvarez", out: false, text: "Send me the pilot scope when you have it.", time: "08:12" }],
  },
  {
    id: "t3", ch: "wa", name: "Ines Moreau", group: false, members: 2, unread: 0, time: "Yesterday",
    msgs: [
      { who: "Ines Moreau", out: false, text: "The research run came back clean. Invoice me.", time: "17:20" },
      { who: "Mara Jansen", out: true, text: "Sent, outcome-priced as agreed.", time: "17:44" },
    ],
  },
  {
    id: "t4", ch: "sl", name: "Pilot candidates", group: true, members: 9, unread: 2, time: "Mon",
    msgs: [{ who: "Research agent", out: false, text: "Two new inbounds match the Benelux operator profile.", time: "11:02" }],
  },
  {
    id: "t5", ch: "dc", name: "Robot fleet", group: true, members: 4, unread: 0, time: "Mon",
    msgs: [{ who: "Unit R-02", out: false, text: "Cycle count aisles 4-6 complete. 3 discrepancies logged.", time: "04:12" }],
  },
];

export function Channels() {
  const [activeChip, setActiveChip] = useState("tg");
  const [activeThread, setActiveThread] = useState("t1");

  const chipUnread = (chId: string) =>
    THREADS.filter((t) => t.ch === chId).reduce((sum, t) => sum + t.unread, 0);
  const visibleThreads = THREADS.filter((t) => t.ch === activeChip);
  const thread = THREADS.find((t) => t.id === activeThread) ?? visibleThreads[0] ?? THREADS[0]!;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="text-[36px] leading-[1.1] tracking-[-0.02em]">Channels</h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Pick which of your configured channels to work in. Connections are set up in System
            configuration — here you only choose.
          </p>
        </div>
        <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
          New group
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHANNEL_CHIPS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => {
              setActiveChip(ch.id);
              const first = THREADS.find((t) => t.ch === ch.id);
              setActiveThread(first ? first.id : "");
            }}
            title={ch.name}
            className={cn(
              "flex h-[38px] items-center gap-2 rounded-full border pr-3.5 pl-2 text-sm",
              ch.id === activeChip ? "border-foreground" : "border-border",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white"
              style={{ background: channelColor(ch.hue) }}
            >
              {ch.mono}
            </span>
            {ch.name}
            {chipUnread(ch.id) > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-space-accent px-1 font-display text-[9px] font-extrabold text-space-accent-foreground">
                {chipUnread(ch.id)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex h-[560px] min-h-0 items-stretch gap-3">
        <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border">
          <div className="shrink-0 border-b border-border p-3">
            <input
              placeholder="Search conversations"
              className="h-[34px] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleThreads.map((t) => {
              const chip = CHANNEL_CHIPS.find((c) => c.id === t.ch)!;
              const mono = t.group ? "gr" : t.name.slice(0, 2).toLowerCase();
              const last = t.msgs[t.msgs.length - 1];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveThread(t.id)}
                  style={{ borderLeftColor: t.id === activeThread ? channelColor(chip.hue) : "transparent" }}
                  className="flex w-full items-center gap-2.5 border-l-[3px] px-3 py-2.5 text-left hover:bg-background"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white"
                    style={{ background: channelColor(chip.hue) }}
                  >
                    {mono}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <span className="flex items-baseline gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {last ? last.text : "No messages yet"}
                      </span>
                      {t.unread > 0 ? (
                        <span className="flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full bg-space-accent px-1 font-display text-[9px] font-extrabold text-space-accent-foreground">
                          {t.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white"
              style={{ background: channelColor(CHANNEL_CHIPS.find((c) => c.id === thread.ch)!.hue) }}
            >
              {thread.group ? "gr" : thread.name.slice(0, 2).toLowerCase()}
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <span className="truncate font-display text-[15px] font-extrabold">{thread.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {thread.group ? `${thread.members} members · group` : "Direct message"}
              </span>
            </span>
            <span className="ml-auto text-[10px] tracking-[0.1em] text-accent-ink uppercase">
              {CHANNEL_CHIPS.find((c) => c.id === activeChip)?.name}
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-background p-4">
            {thread.msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.out ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[72%] rounded-tl-[14px] rounded-tr-[14px] px-2.5 py-2",
                    m.out
                      ? "rounded-bl-[14px] rounded-br-[4px] bg-space-accent text-space-accent-foreground"
                      : "rounded-br-[14px] rounded-bl-[4px] border border-border bg-card shadow-[var(--shadow-sm)]",
                  )}
                >
                  {!m.out ? (
                    <span className="mb-0.5 block font-display text-[11px] font-extrabold text-accent-ink">
                      {m.who}
                    </span>
                  ) : null}
                  <span className="block text-[13px] leading-relaxed">{m.text}</span>
                  <span className="mt-0.5 block text-right text-[10px] opacity-60">{m.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
            <button className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-muted" title="Attach file">
              <Paperclip className="size-[18px]" />
            </button>
            <input
              placeholder="Message…"
              className="h-[38px] min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
            />
            <button className="flex size-[38px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-space-accent text-space-accent-foreground hover:opacity-90" title="Send">
              <Send className="size-[17px]" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
