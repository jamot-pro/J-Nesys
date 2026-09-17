"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createLeadList,
  deleteLeadList,
  listLeadLists,
  listLeadProviders,
  updateLeadList,
  type CreateLeadListInput,
  type LeadList,
  type LeadProviderView,
} from "@jamot/client";

/**
 * Shared behavior behind the "Lead Generation" app's list management,
 * previously duplicated between apps/console/LeadGen.tsx and
 * apps/web/LeadsWorkspace.tsx. Each frontend keeps its own presentation
 * (console has no Tailwind/component library, web does) — this hook is the
 * one place the actual API sequencing and state transitions live, so the two
 * surfaces cannot drift on what "create", "reload", or "delete" do.
 */
export function useLeadListsController(spaceId: string | null, organizationId: string | null) {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [providers, setProviders] = useState<LeadProviderView[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!spaceId) {
      setLists([]);
      setLoading(false);
      return [] as LeadList[];
    }
    try {
      const items = await listLeadLists(spaceId, organizationId);
      setLists(items);
      return items;
    } catch {
      setLists([]);
      return [] as LeadList[];
    } finally {
      setLoading(false);
    }
  }, [spaceId, organizationId]);

  const reloadProviders = useCallback(async () => {
    if (!spaceId) {
      setProviders([]);
      return [] as LeadProviderView[];
    }
    try {
      const items = await listLeadProviders(spaceId, organizationId);
      setProviders(items);
      return items;
    } catch {
      setProviders([]);
      return [] as LeadProviderView[];
    }
  }, [spaceId, organizationId]);

  useEffect(() => {
    void reload();
    void reloadProviders();
  }, [reload, reloadProviders]);

  // A run is fire-and-forget server-side now (packages/api's /run route
  // doesn't block on it), so this is the only way anything finds out how a
  // running search is doing — poll while at least one list is "running",
  // and stop as soon as none are, rather than polling forever.
  const hasRunning = lists.some((l) => l.status === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => void reload(), 3000);
    return () => clearInterval(interval);
  }, [hasRunning, reload]);

  const create = useCallback(
    async (input: Omit<CreateLeadListInput, "spaceId" | "organizationId">) => {
      if (!spaceId) throw new Error("no space selected");
      const created = await createLeadList({ ...input, spaceId, organizationId });
      await reload();
      return created;
    },
    [spaceId, organizationId, reload],
  );

  const update = useCallback(
    async (id: string, patch: Parameters<typeof updateLeadList>[1]) => {
      const updated = await updateLeadList(id, patch);
      setLists((current) => current.map((l) => (l.id === updated.id ? updated : l)));
      return updated;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteLeadList(id);
      await reload();
    },
    [reload],
  );

  return { lists, providers, loading, reload, reloadProviders, create, update, remove };
}
