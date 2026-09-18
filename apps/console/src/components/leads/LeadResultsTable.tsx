"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LeadList, LeadView } from "@/lib/api-client";

export function LeadResultsTable({
  list,
  leads,
  loading,
  running,
  onRun,
  onEnrich,
}: {
  list: LeadList;
  leads: LeadView[];
  loading: boolean;
  running: boolean;
  onRun: () => void;
  onEnrich: (personId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{list.name}</h3>
          <p className="text-xs text-muted-foreground">
            {list.providerId} · {list.leadCount} leads · status{" "}
            <span className="font-medium">{list.status}</span>
            {list.error ? <span className="text-destructive"> · {list.error}</span> : null}
          </p>
        </div>
        <Button size="sm" onClick={onRun} disabled={running || list.status === "running"}>
          {running || list.status === "running" ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : null}
          {list.status === "running" ? "Running…" : "Generate leads"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading leads…
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No leads yet. Draw an area, configure the persona, then run generation.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-border bg-sidebar text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Industry</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {lead.person?.displayName ?? "—"}
                    <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{lead.person?.title ?? "—"}</td>
                  <td className="px-3 py-2">{lead.person?.company ?? "—"}</td>
                  <td className="px-3 py-2">{lead.person?.industry ?? "—"}</td>
                  <td className="px-3 py-2">{lead.person?.location ?? "—"}</td>
                  <td className="px-3 py-2">
                    {lead.person?.email ? (
                      <a
                        href={`mailto:${lead.person.email}`}
                        className="text-space-accent hover:underline"
                      >
                        {lead.person.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onEnrich(lead.personId)}>
                      Enrich
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}