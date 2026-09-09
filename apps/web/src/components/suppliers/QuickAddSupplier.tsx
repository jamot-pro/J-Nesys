"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, Field, TextInput } from "@/components/settings/section-primitives";
import { cn } from "@/lib/utils";
import {
  addOrganizationMember,
  registerSupplier,
  type ApiActor,
  type OrganizationListItem,
} from "@/lib/api-client";

type Mode = "existing" | "new";

const MODES: { value: Mode; label: string; description: string }[] = [
  {
    value: "existing",
    label: "Existing person",
    description: "Register a person or agent already in the directory.",
  },
  {
    value: "new",
    label: "New person",
    description: "Invite someone into the organization, then register them.",
  },
];

export function QuickAddSupplier({
  actors,
  organizations,
  orgId,
  onAdded,
  onDone,
}: {
  actors: ApiActor[];
  organizations: OrganizationListItem[];
  orgId: string | undefined;
  onAdded: () => Promise<void> | void;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("existing");
  const [actorId, setActorId] = useState("");
  const [organizationId, setOrganizationId] = useState<string>(orgId ?? "");
  const [terms, setTerms] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganization = Boolean(orgId);

  const actorOptions = useMemo(
    () =>
      actors
        .filter((actor) => actor.type === "human" || actor.type === "agent")
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [actors],
  );

  const canSubmit = mode === "existing"
    ? Boolean(actorId)
    : Boolean(email.trim()) && isOrganization;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const resolvedOrganizationId = organizationId || null;
      let resolvedActorId = actorId;
      if (mode === "new") {
        if (!orgId) throw new Error("A new person needs an organization space.");
        const member = await addOrganizationMember(orgId, { email: email.trim(), role });
        resolvedActorId = member.actorId;
      }
      await registerSupplier({
        actorId: resolvedActorId,
        organizationId: resolvedOrganizationId,
        terms: terms.trim() || null,
      });
      await onAdded();
      onDone?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not add this supplier. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Add a supplier</h3>
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
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Who is the supplier?</span>
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              disabled={option.value === "new" && !isOrganization}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                mode === option.value
                  ? "border-space-accent bg-space-accent/10"
                  : "border-border hover:bg-muted",
                option.value === "new" && !isOrganization && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  mode === option.value ? "border-space-accent" : "border-border",
                )}
              >
                {mode === option.value ? (
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

        {mode === "existing" ? (
          <Field label="Person or agent" hint="Select someone already in the directory.">
            <select
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              {actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName} ({actor.type})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Email" hint="The person will be invited into this organization.">
              <TextInput
                placeholder="name@example.com"
                type="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <div>
              <span className="text-sm font-medium">Role</span>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {(["member", "admin"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                      role === value
                        ? "border-space-accent bg-space-accent/10"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        role === value ? "border-space-accent" : "border-border",
                      )}
                    >
                      {role === value ? (
                        <span className="size-2 rounded-full bg-space-accent" />
                      ) : null}
                    </span>
                    {value === "member" ? "Member" : "Admin"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <Field label="Organization" hint="Optional commercial counterparty. Defaults to the current organization.">
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Solo supplier (no organization)</option>
            {organizations.map((org) => (
              <option key={org.organization.id} value={org.organization.id}>
                {org.space.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Terms" hint="Optional commercial terms agreed with the supplier.">
          <TextInput
            placeholder="Net 30, delivered DAP…"
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </Field>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Adding…" : "Add supplier"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
