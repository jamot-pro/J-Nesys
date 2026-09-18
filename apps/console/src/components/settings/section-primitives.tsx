"use client";

import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md px-1 py-2.5",
        disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/40",
      )}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium leading-tight">{label}</span>
        {description ? (
          <span className="text-xs leading-snug text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TextInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} />;
}
