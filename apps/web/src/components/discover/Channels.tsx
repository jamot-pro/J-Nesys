"use client";

import { useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors OrgConsole.dc.html's `channels` region pixel-for-pixel: channel
 * chips, a thread list, and a message view. Placeholder content — real
 * channel/thread data isn't wired up here yet.
 */

const CHANNEL_CHIPS = [
  { id: "whatsapp", name: "WhatsApp", mono: "WA", color: "#25D366", unread: 3 },
  { id: "telegram", name: "Telegram", mono: "TG", color: "#229ED9", unread: 0 },
  { id: "email", name: "Email", mono: "@", color: "#605d5d", unread: 12 },
  { id: "instagram", name: "Instagram", mono: "IG", color: "#C13584", unread: 0 },
];

const THREADS = [
  { id: "t1", mono: "MJ", color: "#ff2657", name: "Mara Jansen", time: "2m", preview: "Can you confirm the Vlieland filing?", unread: 2 },
  { id: "t2", mono: "AB", color: "#0ea5e9", name: "Amara Boateng", time: "1h", preview: "Sent the week-3 patterns over", unread: 0 },
  { id: "t3", mono: "PN", color: "#10b981", name: "Priya Nair", time: "3h", preview: "Thanks, that resolved it", unread: 0 },
  { id: "t4", mono: "KW", color: "#f59e0b", name: "Kai Whetu", time: "1d", preview: "Recording upload finished", unread: 1 },
  { id: "t5", mono: "TR", color: "#8b5cf6", name: "Tomás Ríos", time: "2d", preview: "Firmware build passed CI", unread: 0 },
];

const MESSAGES = [
  { who: "Mara Jansen", showWho: true, text: "Hey — can you confirm the Vlieland municipal filing is complete?", time: "10:02" },
  { who: "You", showWho: false, text: "Checking now, give me a minute.", time: "10:03" },
  { who: "You", showWho: false, text: "Confirmed, filed yesterday. I'll close the task.", time: "10:06" },
  { who: "Mara Jansen", showWho: true, text: "Perfect, thank you!", time: "10:07" },
];

export function Channels() {
  const [activeChip, setActiveChip] = useState("whatsapp");
  const [activeThread, setActiveThread] = useState("t1");

  const thread = THREADS.find((t) => t.id === activeThread) ?? THREADS[0]!;

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
            onClick={() => setActiveChip(ch.id)}
            title={ch.name}
            className={cn(
              "flex h-[38px] items-center gap-2 rounded-full border pr-3.5 pl-2 text-sm",
              ch.id === activeChip ? "border-foreground" : "border-border",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white"
              style={{ background: ch.color }}
            >
              {ch.mono}
            </span>
            {ch.name}
            {ch.unread > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-space-accent px-1 font-display text-[9px] font-extrabold text-space-accent-foreground">
                {ch.unread}
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
            {THREADS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveThread(t.id)}
                style={{ borderLeftColor: t.id === activeThread ? t.color : "transparent" }}
                className="flex w-full items-center gap-2.5 border-l-[3px] px-3 py-2.5 text-left hover:bg-background"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white"
                  style={{ background: t.color }}
                >
                  {t.mono}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span className="flex items-baseline gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t.preview}</span>
                    {t.unread > 0 ? (
                      <span className="flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full bg-space-accent px-1 font-display text-[9px] font-extrabold text-space-accent-foreground">
                        {t.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white"
              style={{ background: thread.color }}
            >
              {thread.mono}
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <span className="truncate font-display text-[15px] font-extrabold">{thread.name}</span>
              <span className="text-[11px] text-muted-foreground">Active 2m ago</span>
            </span>
            <span className="ml-auto text-[10px] tracking-[0.1em] text-accent-ink uppercase">
              {CHANNEL_CHIPS.find((c) => c.id === activeChip)?.name}
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-background p-4">
            {MESSAGES.map((m, i) => (
              <div key={i} className="flex justify-start">
                <div className="max-w-[72%] rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] border border-border bg-card px-2.5 py-2 shadow-[var(--shadow-sm)]">
                  {m.showWho ? (
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
