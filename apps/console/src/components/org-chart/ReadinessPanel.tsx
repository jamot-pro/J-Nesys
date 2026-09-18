"use client";

import { CheckCircle2, Gauge, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReadinessReport } from "@/lib/api-client";

function pct(score: number): number {
  return Math.round(score * 100);
}

export function ReadinessPanel({
  report,
  loading,
}: {
  report: ReadinessReport | null;
  loading: boolean;
}) {
  const jamot = Boolean(report && report.overall === 1 && report.jamot);

  return (
    <div className="pointer-events-auto w-64 rounded-lg border border-border bg-card/90 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-space-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          DREAM Readiness
        </h3>
        {jamot ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <Sparkles className="size-3" />
            JAMOT
          </span>
        ) : null}
      </div>

      {loading && !report ? (
        <p className="mt-2 text-xs text-muted-foreground">Computing readiness…</p>
      ) : report ? (
        <>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Overall</span>
            <span className="font-display text-lg font-semibold">
              {pct(report.overall)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                report.overall === 1 ? "bg-emerald-500" : "bg-space-accent",
              )}
              style={{ width: `${report.overall * 100}%` }}
            />
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {report.dimensions.map((dimension) => {
              const done = dimension.score === 1;
              return (
                <li key={dimension.key} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs">
                      {done ? (
                        <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
                      ) : (
                        <span
                          className="size-3 shrink-0 rounded-full border"
                          style={{ borderColor: "var(--border)" }}
                        />
                      )}
                      <span className="truncate text-foreground">
                        {dimension.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {pct(dimension.score)}%
                    </span>
                  </div>
                  {!done && dimension.missing.length > 0 ? (
                    <p className="pl-4 text-[10px] leading-snug text-muted-foreground">
                      {dimension.missing.join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[10px] text-muted-foreground">
            Updated {new Date(report.updatedAt).toLocaleTimeString()}
          </p>
        </>
      ) : null}
    </div>
  );
}