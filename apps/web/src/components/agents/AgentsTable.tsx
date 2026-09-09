"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import type { DirectoryMatch } from "@/components/directory/search";
import { cn } from "@/lib/utils";
import { AUTONOMY_LABEL, type AgentProfile as Agent } from "./agents-data";

const AVAILABILITY: Record<
  Agent["availability"],
  { label: string; dot: string }
> = {
  available: { label: "Available", dot: "bg-emerald-500" },
  busy: { label: "Busy", dot: "bg-amber-500" },
  offline: { label: "Offline", dot: "bg-zinc-400" },
};

function reputationScore(agent: Agent): number {
  const values = Object.values(agent.reputation);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

type SortKey =
  | "name"
  | "role"
  | "channels"
  | "active"
  | "reputation"
  | "availability";

interface Column {
  key: SortKey;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  sortValue: (agent: Agent) => string | number;
}

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Agent",
    headerClassName: "w-[26%]",
    sortValue: (agent) => agent.name.toLowerCase(),
  },
  {
    key: "role",
    label: "Role",
    headerClassName: "w-[18%]",
    sortValue: (agent) => agent.role.toLowerCase(),
  },
  {
    key: "channels",
    label: "Channels",
    headerClassName: "w-[16%]",
    sortValue: (agent) => agent.channels.join(", ").toLowerCase(),
  },
  {
    key: "active",
    label: "Active",
    headerClassName: "w-[10%]",
    sortValue: (agent) => agent.tasks.active,
  },
  {
    key: "reputation",
    label: "Reputation",
    headerClassName: "w-[12%]",
    sortValue: (agent) => reputationScore(agent),
  },
  {
    key: "availability",
    label: "Availability",
    headerClassName: "w-[14%]",
    sortValue: (agent) => AVAILABILITY[agent.availability].label.toLowerCase(),
  },
];

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export function AgentsTable({
  agents,
  matches,
  showMatch,
  onOpen,
}: {
  agents: Agent[];
  matches: Record<string, DirectoryMatch>;
  showMatch: boolean;
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const toggleSort = (key: SortKey) => {
    setSort((previous) => {
      if (previous?.key === key) {
        return previous.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  };

  const sorted = useMemo(() => {
    const list = [...agents];
    if (!sort) return list;
    const column = COLUMNS.find((candidate) => candidate.key === sort.key);
    if (!column) return list;
    list.sort((a, b) => {
      const av = column.sortValue(a);
      const bv = column.sortValue(b);
      const comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? comparison : -comparison;
    });
    return list;
  }, [agents, sort]);

  return (
    <div className="min-w-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-sidebar">
          <tr>
            {COLUMNS.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground",
                    column.headerClassName,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {column.label}
                    {active ? (
                      sort?.dir === "asc" ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
            {showMatch ? (
              <th className="w-[20%] border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                Match
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent) => {
            const match = matches[agent.id];
            const score = reputationScore(agent);
            const availability = AVAILABILITY[agent.availability];
            return (
              <tr
                key={agent.id}
                onClick={() => onOpen(agent.id)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={agent.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {agent.name}
                      </span>
                      {match ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {match.snippet}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">
                  {agent.role}
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">
                  {agent.channels.length > 0
                    ? agent.channels.join(", ")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {agent.tasks.active} active
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1 font-medium tabular-nums">
                    <Sparkles className="size-3 fill-space-accent/20 text-space-accent" />
                    {score}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {AUTONOMY_LABEL[agent.autonomy]}
                  </span>
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn("size-2 rounded-full", availability.dot)}
                      aria-hidden
                    />
                    {availability.label}
                  </span>
                </td>
                {showMatch ? (
                  <td className="px-3 py-2">
                    {match ? (
                      <span className="flex flex-wrap gap-1">
                        {match.matchedFields.map((label) => (
                          <span
                            key={label}
                            className="rounded bg-space-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-space-accent"
                          >
                            {label}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}