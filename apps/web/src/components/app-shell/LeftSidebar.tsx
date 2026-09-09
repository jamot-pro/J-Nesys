"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  LogIn,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/components/auth/auth-context";
import { useActiveOrgBranding } from "@/components/settings/use-org-branding";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { useAppShell } from "./app-shell-context";

export function LeftSidebar() {
  const { name } = useActiveOrgBranding();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo className="size-5" />
          <span className="min-w-0 truncate font-display text-xs font-semibold tracking-tight">
            {name || "Jamot"}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={searchOpen ? "Close search" : "Search chats"}
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery("");
          }}
        >
          {searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
        </Button>
      </div>

      <AnimatePresence>
        {searchOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border/40 p-2"
          >
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history…"
              className="h-7 rounded-lg text-xs"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="min-h-0 flex-1">
        <ChatHistory searchQuery={query} />
      </div>

      <SpaceSwitcher />
    </aside>
  );
}

function SpaceSwitcher() {
  const { space, setSpace, spaces } = useAppShell();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative border-t border-border/40 p-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar name={user?.actor.displayName ?? "Andrea"} size="xs" />
          <span className="truncate text-xs font-medium">
            {user?.actor.displayName ?? "Andrea"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Settings menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Settings className="size-3.5" />
        </Button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass-card glass-border absolute bottom-full left-2 right-2 z-20 mb-1.5 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
              {space.name}
            </p>
            <ul className="flex flex-col gap-0.5">
              {spaces.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSpace(candidate.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/70"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: candidate.accent }}
                    />
                    <span className="flex-1 text-left font-medium">{candidate.name}</span>
                    {space.id === candidate.id ? (
                      <Check className="size-3.5 text-space-accent" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-1">
              <Link
                href="/settings"
                className="flex flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <Settings className="size-3.5" />
                Settings
              </Link>
              {user?.isSuperAdmin ? (
                <Link
                  href="/admin"
                  className="flex flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  <ShieldCheck className="size-3.5" />
                  Admin
                </Link>
              ) : null}
              <ThemeToggle />
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2 rounded-xl border-t border-border/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="flex w-full items-center gap-2 rounded-xl border-t border-border/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <LogIn className="size-3.5" />
                Sign in
              </Link>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
