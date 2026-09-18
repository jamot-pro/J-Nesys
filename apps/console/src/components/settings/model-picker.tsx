"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { decodeModelRef, encodeModelRef, listEnabledModels, type ApiEnabledModel } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ModelPickerProps {
  organizationId?: string | null;
  /** `providerId::modelId` string or `null` for auto/first-enabled */
  value: string | null;
  onChange(value: string | null): void;
  disabled?: boolean;
}

const VISIBLE_ROWS = 6;
const ROW_HEIGHT = 40; // px including padding

/** Label for a single model entry in the picker list. */
function modelLabel(model: ApiEnabledModel): string {
  return `${model.providerName} / ${model.modelId}`;
}

export function ModelPicker({ organizationId, value, onChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<ApiEnabledModel[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || models.length > 0) return;
    setLoading(true);
    listEnabledModels(organizationId ?? undefined)
      .then((m: ApiEnabledModel[]) => setModels(m))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, organizationId]);

  /* Click-outside close */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const q = query.trim().toLowerCase();
  const filtered = models.filter((m) =>
    q ? modelLabel(m).toLowerCase().includes(q) : true,
  );

  /* Determine what to display on the trigger button */
  const selectedRef = value;
  const selectedDisplay = (() => {
    if (!selectedRef) return "Auto — first enabled";
    const ref = decodeModelRef(selectedRef);
    if (!ref) return value;
    const match = models.find(
      (m) => m.providerId === ref.providerId && m.modelId === ref.modelId,
    );
    return match ? modelLabel(match) : selectedRef;
  })();

  if (disabled) {
    return (
      <div className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground">
        <span>{selectedDisplay}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={loading}
      >
        {loading && models.length === 0 ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{selectedDisplay}</span>
      </button>

      {/* Popover panel */}
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          {/* Search */}
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

          {/* Options list - max 6 visible rows then scroll */}
          <div
            className="overflow-y-auto p-1.5"
            style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
          >
            {/* Auto / first-enabled option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                !value ? "bg-space-accent/10 text-foreground" : "hover:bg-muted",
              )}
            >
              <span className="size-4" />
              <span className="min-w-0 flex-1 truncate">
                Auto — first enabled
              </span>
              {!value ? <Check className="size-4 shrink-0 text-space-accent" /> : null}
            </button>

            {/* Individual models */}
            {filtered.map((model) => {
              const ref = encodeModelRef(model.providerId, model.modelId);
              const active = selectedRef === ref;
              return (
                <button
                  key={`${model.providerId}::${model.modelId}`}
                  type="button"
                  onClick={() => {
                    onChange(ref);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                    active
                      ? "bg-space-accent/10 text-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    {modelLabel(model)}
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-space-accent" />
                  ) : null}
                </button>
              );
            })}

            {filtered.length === 0 && models.length > 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No matches.
              </p>
            ) : null}

            {models.length === 0 && !loading ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No models configured yet.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
