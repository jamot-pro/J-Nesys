"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Mirrors OrgConsole.dc.html's `wallet` modal region pixel-for-pixel.
 * Placeholder content — no real treasury/spend backend wired up here yet.
 */

const MOVEMENTS = [
  { when: "2h ago", what: "Payout — Permit Tracker agent run", amount: "-€4.20" },
  { when: "1d ago", what: "Top-up via card ending 4471", amount: "+€200.00" },
  { when: "2d ago", what: "Payout — Translator agent run", amount: "-€1.80" },
  { when: "4d ago", what: "Task reward — Mara Jansen", amount: "-€45.00" },
];

export function WalletModal({ onClose }: { onClose: () => void }) {
  const [cap, setCap] = useState("€250 / month");

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-8"
      style={{ background: "color-mix(in srgb, #201e1d 30%, transparent)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <span className="flex-1 font-display text-[13px] font-extrabold tracking-[0.14em] uppercase">
            Wallet
          </span>
          <button
            onClick={onClose}
            title="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 rounded-[var(--radius-md)] bg-background px-4 py-3">
              <span className="font-display text-[26px] leading-[1.1] font-extrabold">€612.40</span>
              <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Available balance
              </span>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 rounded-[var(--radius-md)] bg-background px-4 py-3">
              <span className="font-display text-[26px] leading-[1.1] font-extrabold">€187.60</span>
              <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Spent this month
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Monthly cap for agents and robots</label>
            <input
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="h-10 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
            />
          </div>

          <div>
            <span className="font-display text-[11px] font-extrabold tracking-[0.1em] uppercase">
              Recent movements
            </span>
            <div className="mt-3 flex flex-col">
              {MOVEMENTS.map((w, i) => (
                <div key={i} className="flex items-baseline gap-3 border-b border-border py-2.5 text-[13px]">
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{w.when}</span>
                  <span className="min-w-0 flex-1 leading-relaxed">{w.what}</span>
                  <span className="shrink-0 font-display font-extrabold">{w.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Outcome-based charges settle when the outcome is confirmed, not when the agent runs.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
            Top up
          </button>
          <button
            onClick={onClose}
            className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
