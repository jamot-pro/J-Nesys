"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Search, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { Actor } from "./tasks-data";

type Tab = "human" | "agent";

const TAB_ITEMS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "human", label: "People", icon: User },
  { key: "agent", label: "Agents", icon: Bot },
];

export interface AssigneeSelectProps {
  actors: Actor[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export function AssigneeSelect({ actors, value, onChange }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("human");
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
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

  const selectedActors = actors.filter((a) => value.includes(a.id));
  const q = query.trim().toLowerCase();
  const matches = actors.filter(
    (a) => a.type === tab && (q ? a.displayName.toLowerCase().includes(q) : true),
  );

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted"
      >
        {selectedActors.length === 0 ? (
          <span className="flex-1 text-muted-foreground">
            Select people or agents…
          </span>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {selectedActors.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-md bg-space-accent/10 px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                {a.type === "agent" ? (
                  <Bot className="size-3 text-muted-foreground" />
                ) : (
                  <User className="size-3 text-muted-foreground" />
                )}
                {a.displayName}
                <button
                  type="button"
                  aria-label={`Remove ${a.displayName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(a.id);
                  }}
                  className="rounded p-px text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="h-8 pl-7 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-1 border-b border-border p-1.5">
            {TAB_ITEMS.map((t) => {
              const Icon = t.icon;
              const activeTab = tab === t.key;
              return (
                <Button
                  key={t.key}
                  type="button"
                  size="sm"
                  variant={activeTab ? "secondary" : "ghost"}
                  className="flex-1"
                  onClick={() => setTab(t.key)}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5">
            {matches.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {actors.some((a) => a.type === tab)
                  ? "No matches."
                  : tab === "human"
                    ? "No people yet."
                    : "No agents yet."}
              </p>
            ) : (
              matches.map((a) => {
                const active = value.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                      active ? "bg-space-accent/10 text-foreground" : "hover:bg-muted",
                    )}
                  >
                    {a.type === "agent" ? (
                      <Bot className="size-4 text-muted-foreground" />
                    ) : (
                      <User className="size-4 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{a.displayName}</span>
                    {active ? <Check className="size-4 text-space-accent" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}