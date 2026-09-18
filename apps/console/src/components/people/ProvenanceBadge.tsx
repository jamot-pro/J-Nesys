import { cn } from "@/lib/utils";

import type { ProvenanceSource } from "./people-data";

const SOURCE_META: Record<
  ProvenanceSource,
  { label: string; dot: string; text: string; bg: string }
> = {
  self_declared: {
    label: "Self-declared",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  assessment: {
    label: "Assessment",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  observed: {
    label: "Observed",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  manager_feedback: {
    label: "Manager feedback",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  inferred: {
    label: "Inferred",
    dot: "bg-zinc-400",
    text: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-400/10",
  },
};

export function ProvenanceBadge({
  source,
  confidence,
}: {
  source: ProvenanceSource;
  confidence: number;
}) {
  const meta = SOURCE_META[source];
  const percentage = Math.round(confidence * 100);

  return (
    <span
      title={`${meta.label} · ${percentage}% confidence`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium",
        meta.bg,
        meta.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      <span>{meta.label}</span>
      <span className="tabular-nums opacity-70">{percentage}%</span>
    </span>
  );
}
