"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, X } from "lucide-react";

import {
  dismissMergeCandidate,
  listMergeCandidates,
  resolveMergeCandidate,
  type ApiMergeCandidate,
} from "./people-api";

function nameOf(person: ApiMergeCandidate["personA"]): string {
  if (!person) return "Unknown";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    person.email ||
    person.phone ||
    "Unknown";
}

/**
 * Uncertain identity matches. Jamot never merges people automatically — a
 * human reviews each candidate and decides.
 */
export function MergeReview({
  spaceId,
  onChanged,
}: {
  spaceId: string;
  onChanged: () => void;
}) {
  const [candidates, setCandidates] = useState<ApiMergeCandidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCandidates(await listMergeCandidates(spaceId));
    } catch {
      setCandidates([]);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (candidates.length === 0) return null;

  const act = async (id: string, action: "resolve" | "dismiss") => {
    setBusyId(id);
    try {
      if (action === "resolve") await resolveMergeCandidate(id);
      else await dismissMergeCandidate(id);
      await load();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="shrink-0 border-b border-amber-300/60 bg-amber-50/60 px-4 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center gap-2 text-sm font-medium">
        <GitMerge className="size-4" />
        Possible duplicates need review
      </div>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-sm"
          >
            <span className="font-medium">{nameOf(candidate.personA)}</span>
            <span className="text-muted-foreground">might be the same person as</span>
            <span className="font-medium">{nameOf(candidate.personB)}</span>
            <span className="text-xs text-muted-foreground">({candidate.reason})</span>
            <span className="flex-1" />
            <button
              type="button"
              disabled={busyId === candidate.id}
              onClick={() => void act(candidate.id, "resolve")}
              className="rounded-md bg-space-accent px-2 py-1 text-xs font-medium text-space-accent-foreground disabled:opacity-50"
            >
              Merge
            </button>
            <button
              type="button"
              disabled={busyId === candidate.id}
              onClick={() => void act(candidate.id, "dismiss")}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" /> Not the same
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
