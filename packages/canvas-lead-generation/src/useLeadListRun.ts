"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enrichLead,
  getLeadList,
  listLeadListLeads,
  runLeadList,
  type LeadRunResult,
  type LeadView,
} from "@jamot/client";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The run/enrich orchestration for one Lead List: load its leads, trigger a
 * search run, enrich individual leads. This is the sequencing that was
 * copy-pasted between console's `start()`/`runEnrichment()` and web's
 * `SelectedList`/`handleRun` — kept here once so both surfaces call the same
 * API in the same order and handle the same failure modes.
 */
export function useLeadListRun(listId: string | null) {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadLeads = useCallback(async () => {
    if (!listId) {
      setLeads([]);
      setLoadingLeads(false);
      return [] as LeadView[];
    }
    try {
      const items = await listLeadListLeads(listId);
      setLeads(items);
      return items;
    } catch {
      setLeads([]);
      return [] as LeadView[];
    } finally {
      setLoadingLeads(false);
    }
  }, [listId]);

  useEffect(() => {
    setLoadingLeads(true);
    void reloadLeads();
  }, [reloadLeads]);

  const run = useCallback(
    async (limit?: number): Promise<LeadRunResult | null> => {
      if (!listId) return null;
      setRunning(true);
      setError(null);
      try {
        // The API kicks the run off and responds immediately (it doesn't
        // block on a search that can take minutes) — so "running" here has
        // to mean "poll until the list actually leaves the running state,"
        // not "await this one call."
        await runLeadList(listId, limit);
        let list = await getLeadList(listId);
        while (list.status === "running") {
          await sleep(2000);
          list = await getLeadList(listId);
        }
        if (list.error) setError(list.error);
        await reloadLeads();
        return {
          listId: list.id,
          status: list.status,
          totalFound: list.leadCount,
          added: list.leadCount,
          skipped: 0,
          error: list.error,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "The run failed.");
        return null;
      } finally {
        setRunning(false);
      }
    },
    [listId, reloadLeads],
  );

  const enrichOne = useCallback(
    async (personId: string) => {
      if (!listId) return;
      setError(null);
      try {
        await enrichLead(listId, personId);
        await reloadLeads();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not enrich lead");
        throw err;
      }
    },
    [listId, reloadLeads],
  );

  return { leads, loadingLeads, running, error, setError, run, enrichOne, reloadLeads };
}
