"use client";

import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { createCatalog } from "@copilotkit/a2ui-renderer";

export interface Supplier {
  name: string;
  price: number;
  days: number;
  score: number;
}

type CardAction = {
  event: {
    name: string;
    context?: Record<string, unknown>;
  };
};

interface SupplierCardRendererProps {
  props: { suppliers: Supplier[] };
  dispatch?: (action: CardAction) => void;
}

function SupplierCardRenderer({ props, dispatch }: SupplierCardRendererProps) {
  const best = props.suppliers.reduce<Supplier | undefined>(
    (acc, s) => (!acc || s.score > acc.score ? s : acc),
    undefined,
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Supplier comparison</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {props.suppliers.length} suppliers
        </span>
      </div>

      <ul className="space-y-2">
        {props.suppliers.map((s) => (
          <li
            key={s.name}
            className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.name}</span>
                {best !== undefined && s.name === best.name && (
                  <span className="rounded bg-space-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-space-accent">
                    Best
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                €{Math.round(s.price / 1000)}k · {s.days} days
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-space-accent"
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {s.score}%
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            dispatch?.({
              event: { name: "compare", context: { suppliers: props.suppliers } },
            })
          }
          className="rounded-md bg-space-accent px-3 py-1.5 text-xs font-medium text-space-accent-foreground hover:opacity-90"
        >
          Compare
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch?.({
              event: { name: "assign", context: { supplier: best?.name } },
            })
          }
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch?.({
              event: { name: "contact", context: { supplier: best?.name } },
            })
          }
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Contact
        </button>
      </div>
    </div>
  );
}

interface BudgetWarningRendererProps {
  props: { message: string; severity: string };
  dispatch?: (action: CardAction) => void;
}

function BudgetWarningRenderer({ props, dispatch }: BudgetWarningRendererProps) {
  const critical = props.severity === "critical";

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
        critical
          ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{props.message}</p>
        <button
          type="button"
          onClick={() =>
            dispatch?.({
              event: { name: "review-budget", context: { severity: props.severity } },
            })
          }
          className="mt-1 text-xs underline underline-offset-2"
        >
          Review budget
        </button>
      </div>
    </div>
  );
}

const definitions = {
  SupplierCard: {
    description: "A supplier comparison card",
    props: z.object({
      suppliers: z.array(
        z.object({
          name: z.string(),
          price: z.number(),
          days: z.number(),
          score: z.number(),
        }),
      ),
    }),
  },
  BudgetWarning: {
    description: "A budget warning banner",
    props: z.object({
      message: z.string(),
      severity: z.string(),
    }),
  },
};

const renderers = {
  SupplierCard: SupplierCardRenderer,
  BudgetWarning: BudgetWarningRenderer,
};

export const catalog = createCatalog(definitions, renderers, {
  includeBasicCatalog: true,
});

export const theme = {
  colors: {
    primary: "var(--space-accent)",
    primaryForeground: "var(--space-accent-foreground)",
    background: "var(--background)",
    foreground: "var(--foreground)",
    muted: "var(--muted)",
    mutedForeground: "var(--muted-foreground)",
    border: "var(--border)",
    card: "var(--card)",
    cardForeground: "var(--card-foreground)",
  },
  radius: "var(--radius)",
};
