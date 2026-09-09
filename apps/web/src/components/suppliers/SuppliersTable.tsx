"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { SupplierView } from "./types";

type SortKey = "name" | "organization" | "status" | "currency" | "reputation";

interface Column {
  key: SortKey;
  label: string;
  headerClassName?: string;
  sortValue: (row: SupplierView) => string | number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "accent"> = {
  active: "default",
  invited: "accent",
  suspended: "secondary",
};

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Supplier",
    headerClassName: "w-[26%]",
    sortValue: (row) => row.actorName.toLowerCase(),
  },
  {
    key: "organization",
    label: "Organization",
    headerClassName: "w-[22%]",
    sortValue: (row) => (row.orgName ?? "").toLowerCase(),
  },
  {
    key: "status",
    label: "Status",
    headerClassName: "w-[16%]",
    sortValue: (row) => row.supplier.onboardingStatus.toLowerCase(),
  },
  {
    key: "currency",
    label: "Currency",
    headerClassName: "w-[14%]",
    sortValue: (row) => row.supplier.defaultCurrency.toLowerCase(),
  },
  {
    key: "reputation",
    label: "Reputation",
    headerClassName: "w-[12%]",
    sortValue: (row) => reputationScore(row.supplier.reputation),
  },
];

export function reputationScore(reputation: Record<string, number>): number {
  if (typeof reputation.procurement === "number") return reputation.procurement;
  const values = Object.values(reputation);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export function SuppliersTable({
  rows,
  onOpen,
}: {
  rows: SupplierView[];
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
    const list = [...rows];
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
  }, [rows, sort]);

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
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const { supplier } = row;
            return (
              <tr
                key={supplier.id}
                onClick={() => onOpen(supplier.id)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.actorName} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.actorName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {supplier.terms || "—"}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">
                  {row.orgName ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[supplier.onboardingStatus] ?? "outline"}>
                    {supplier.onboardingStatus}
                  </Badge>
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">
                  {supplier.defaultCurrency || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1 font-medium tabular-nums">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {reputationScore(supplier.reputation)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
