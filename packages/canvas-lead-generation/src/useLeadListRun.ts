"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enrichLead,
  listLeadListLeads,
  runLeadList,
  type LeadRunResult,
  type LeadView,
} from "@jamot/client";

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
        const result = await runLeadList(listId, limit);
        if (result.error) setError(result.error);
        await reloadLeads();
        return result;
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
