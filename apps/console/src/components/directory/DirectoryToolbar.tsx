"use client";

import type { ReactNode } from "react";

import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DirectoryToolbar({
  placeholder,
  query,
  loading,
  onQueryChange,
  onSubmit,
  onClear,
  actionLabel,
  actionIcon,
  onAction,
}: {
  placeholder: string;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  actionLabel: string;
  actionIcon: ReactNode;
  onAction: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="h-9 pl-8 pr-16"
        />
        {query ? (
          <>
            {loading ? (
              <Loader2 className="absolute right-7 top-1/2 size-4 -translate-y-1/2 animate-spin text-space-accent" />
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-7 top-1/2 size-6 -translate-y-1/2"
                aria-label="Ask Main Manager"
                onClick={onSubmit}
              >
                <Search className="size-3.5" />
              </Button>
            )}
            <button
              type="button"
              aria-label="Clear search"
              onClick={onClear}
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      <Button size="sm" onClick={onAction} className="shrink-0">
        {actionIcon}
        {actionLabel}
      </Button>
    </div>
  );
}