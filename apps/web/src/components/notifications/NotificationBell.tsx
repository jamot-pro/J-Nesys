"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Lightbulb,
  ListTodo,
  MessageCircle,
  Sparkles,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useNotifications, type NotificationType } from "./notifications-context";

const TYPE_META: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  approval: { icon: UserRoundCheck, className: "text-blue-500" },
  completed: { icon: CircleCheck, className: "text-emerald-500" },
  warning: { icon: CircleAlert, className: "text-amber-500" },
  opportunity: { icon: MessageCircle, className: "text-space-accent" },
  proposal: { icon: Workflow, className: "text-violet-500" },
  message: { icon: MessageCircle, className: "text-emerald-500" },
};

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { setActiveSection } = useAppShell();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleItemClick = (item: (typeof items)[0]) => {
    markRead(item.id);
    if (item.targetSection) {
      setActiveSection(item.targetSection);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative size-8"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-space-accent animate-pulse" />
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="glass-card glass-border absolute right-0 top-full z-50 mt-2 w-84 overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
              <h3 className="font-display text-xs font-semibold tracking-wide uppercase text-foreground">
                Activity & Alerts
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-space-accent/10">
                  <Sparkles className="size-5 text-space-accent" />
                </div>
                <p className="text-xs font-semibold text-foreground">All caught up</p>
                <p className="max-w-[200px] text-[11px] text-muted-foreground">
                  No overdue tasks, pending channel alerts, or unread messages.
                </p>
              </div>
            ) : (
              <ul className="max-h-84 overflow-y-auto p-1.5 space-y-1">
                {items.map((item) => {
                  const meta = TYPE_META[item.type] || TYPE_META.completed;
                  const Icon = meta.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "group flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all",
                          !item.read
                            ? "bg-card shadow-2xs border border-border/40 hover:bg-muted/60"
                            : "opacity-60 hover:opacity-100 hover:bg-muted/40",
                        )}
                      >
                        <div className="mt-0.5 rounded-xl bg-muted/60 p-1.5 shrink-0">
                          <Icon className={cn("size-3.5", meta.className)} />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {item.title}
                            </span>
                            {!item.read ? (
                              <span className="size-1.5 shrink-0 rounded-full bg-space-accent" />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {item.summary}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {items.length > 0 ? (
              <div className="border-t border-border/40 p-1.5">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
