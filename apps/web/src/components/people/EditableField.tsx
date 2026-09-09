"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Notion-style inline editable field: click → edit → autosave on blur/Enter
 * with a small "Saved" indicator. No big edit forms.
 */
export function EditableField({
  label,
  value,
  onSave,
  placeholder = "Add…",
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim() === "" ? null : draft.trim();
    if (next === (value ?? null)) return;
    setState("saving");
    try {
      await onSave(next);
      setState("saved");
      savedTimer.current = setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      setDraft(value ?? "");
      savedTimer.current = setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <div className="group flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {state === "saved" ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" /> Saved
          </span>
        ) : state === "saving" ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : state === "error" ? (
          <span className="text-xs text-red-600 dark:text-red-400">
            Couldn&apos;t save
          </span>
        ) : null}
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commit();
            if (event.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-space-accent"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setDraft(value ?? "");
            setEditing(true);
          }}
          className={cn(
            "w-full rounded-md px-2 py-1 text-left text-sm transition-colors",
            value ? "text-foreground" : "text-muted-foreground",
            disabled
              ? "cursor-default"
              : "hover:bg-muted/60 cursor-text",
          )}
        >
          {value || placeholder}
        </button>
      )}
    </div>
  );
}
