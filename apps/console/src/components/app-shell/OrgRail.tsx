"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Grid2x2, Plus } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { useAppShell } from "./app-shell-context";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Right-hand org-switcher rail — one icon per real workspace from
 * useAppShell().spaces (personal space + every organization/workspace the
 * user actually belongs to). No placeholder orgs. */
export function OrgRail() {
  const { space, spaces, setSpace } = useAppShell();
  const { user } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <nav className="relative flex h-full w-[60px] shrink-0 flex-col items-center overflow-hidden rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-sm)]">
      <div className="flex h-[52px] w-full shrink-0 flex-col items-center justify-center gap-0.5 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Orgs
        </span>
        <span className="font-display text-xs font-extrabold leading-none">
          {spaces.length}
        </span>
      </div>

      <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
        {spaces.map((candidate) => {
          const active = candidate.id === space.id;
          return (
            <button
              key={candidate.id}
              type="button"
              title={candidate.name}
              onClick={() => setSpace(candidate.id)}
              className="relative size-11 shrink-0 rounded-[var(--radius-sm)] font-display text-sm font-extrabold transition-colors"
              style={
                active
                  ? { background: candidate.accent, color: candidate.accentForeground }
                  : { background: "var(--background)", color: "var(--foreground)" }
              }
            >
              {initialsFor(candidate.name)}
              {active ? (
                <span className="absolute top-1/2 -left-[7px] h-[22px] w-[3px] -translate-y-1/2 rounded-full bg-foreground" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative flex w-full shrink-0 flex-col items-center gap-1 border-t border-border py-2">
        <button
          type="button"
          title="All organizations"
          aria-label="All organizations"
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
        >
          <Grid2x2 className="size-5" />
        </button>
        {user?.isSuperAdmin ? (
          <Link
            href="/admin"
            title="Create an organization"
            aria-label="Create an organization"
            className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-border text-foreground transition-colors hover:border-foreground"
          >
            <Plus className="size-4.5" />
          </Link>
        ) : null}
      </div>

      <AnimatePresence>
        {switcherOpen ? (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setSwitcherOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 8, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute bottom-2 right-[64px] z-30 w-56 rounded-[var(--radius-md)] border border-border bg-card p-1.5 shadow-[var(--shadow-lg)]"
            >
              <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Switch organization
              </p>
              <ul className="flex flex-col gap-0.5">
                {spaces.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSpace(candidate.id);
                        setSwitcherOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: candidate.accent }}
                      />
                      <span className="flex-1 truncate font-medium">{candidate.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
