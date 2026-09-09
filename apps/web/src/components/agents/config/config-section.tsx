"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/settings/section-primitives";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function ConfigSection({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <header className="mb-3 flex items-start gap-2">
        {icon ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-space-accent bg-space-accent/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border text-[10px]",
          selected
            ? "border-space-accent bg-space-accent text-space-accent-foreground"
            : "border-border",
        )}
      >
        {selected ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
            value === option.value
              ? "border-space-accent bg-space-accent/10"
              : "border-border hover:bg-muted",
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
              value === option.value ? "border-space-accent" : "border-border",
            )}
          >
            {value === option.value ? (
              <span className="size-2 rounded-full bg-space-accent" />
            ) : null}
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium">{option.label}</span>
            {option.description ? (
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint} className="gap-1.5">
      {textarea ? (
        <textarea
          rows={rows ?? 3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function ActionBadge({ action }: { action: "automatic" | "approval" | "never" }) {
  const styles: Record<string, string> = {
    automatic: "bg-emerald-500/10 text-emerald-600",
    approval: "bg-amber-500/10 text-amber-600",
    never: "bg-destructive/10 text-destructive",
  };
  const labels: Record<string, string> = {
    automatic: "Automatic",
    approval: "Approval",
    never: "Never",
  };
  return (
    <Badge variant="secondary" className={cn("border-transparent", styles[action])}>
      {labels[action]}
    </Badge>
  );
}

export function SaveBar({
  dirty,
  saving,
  saved,
  error,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : saved && !dirty ? (
            "All changes saved."
          ) : dirty ? (
            "You have unsaved changes."
          ) : (
            "Nothing to save yet."
          )}
        </p>
        <Button
          size="sm"
          disabled={!dirty || saving}
          onClick={onSave}
          className="shrink-0"
        >
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}