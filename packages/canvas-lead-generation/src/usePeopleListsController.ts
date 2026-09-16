"use client";

import { useCallback, useEffect, useState } from "react";
import { createPeopleList, listPeopleLists, type PeopleList } from "@jamot/client";

/**
 * The durable target for search results: a People List, the same kind
 * Outreach and the People screen use. A Lead List (packages/core/src/leads)
 * is just the internal record of one search run against a provider — the
 * user only ever needs to think about which People List results land in.
 */
export function usePeopleListsController(spaceId: string | null) {
  const [lists, setLists] = useState<PeopleList[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!spaceId) {
      setLists([]);
      setLoading(false);
      return [] as PeopleList[];
    }
    try {
      const items = await listPeopleLists(spaceId);
      setLists(items);
      return items;
    } catch {
      setLists([]);
      return [] as PeopleList[];
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (name: string) => {
      if (!spaceId) throw new Error("no space selected");
      const created = await createPeopleList(spaceId, name);
      await reload();
      return created;
    },
    [spaceId, reload],
  );

  return { lists, loading, reload, create };
}
