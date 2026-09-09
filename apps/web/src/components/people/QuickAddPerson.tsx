"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, Field, TextInput } from "@/components/settings/section-primitives";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "member", label: "Member", description: "Standard contributor." },
  { value: "admin", label: "Admin", description: "Can manage members and settings." },
] as const;

export function QuickAddPerson({
  onAdd,
  onDone,
  title = "Add a human",
}: {
  onAdd: (input: { email: string; role: "admin" | "member" }) => Promise<void>;
  onDone?: () => void;
  title?: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({ email: email.trim(), role });
      onDone?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not add this person. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {onDone ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Close"
            onClick={onDone}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Email" hint="The person will get access to this space.">
          <TextInput
            placeholder="name@example.com"
            type="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </Field>

        <div>
          <span className="text-sm font-medium">Role</span>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  role === option.value
                    ? "border-space-accent bg-space-accent/10"
                    : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    role === option.value ? "border-space-accent" : "border-border",
                  )}
                >
                  {role === option.value ? (
                    <span className="size-2 rounded-full bg-space-accent" />
                  ) : null}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!email.trim() || submitting}
            onClick={() => void submit()}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {submitting ? "Adding…" : "Add person"}
          </Button>
        </div>
      </div>
    </Card>
  );
}