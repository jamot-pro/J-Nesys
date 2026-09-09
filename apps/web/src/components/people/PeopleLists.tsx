"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  addOutreachListMembers,
  createOutreachList,
  deleteOutreachList,
  getOrganizationMembers,
  getOutreachListMembers,
  listOutreachLists,
  removeOutreachListMembers,
  type OutreachList,
  type OutreachListMember,
} from "@/lib/api-client";

export function PeopleLists({
  spaceId,
  orgId,
}: {
  spaceId: string | null;
  orgId: string | undefined;
}) {
  const [lists, setLists] = useState<OutreachList[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [listName, setListName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, OutreachListMember[]>>({});
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!spaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no space to load lists for
      setLoading(false);
      setLists([]);
      return;
    }
    listOutreachLists(spaceId)
      .then((items) => {
        if (!cancelled) setLists(items);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  // CopilotKit natural language action listener
  useEffect(() => {
    if (!spaceId) return;
    const handleAddToList = async (e: Event) => {
      const detail = (e as CustomEvent<{ personName: string; listName: string }>).detail;
      if (!detail?.listName) return;
      try {
        let list = lists.find((l) => l.name.toLowerCase() === detail.listName.toLowerCase());
        if (!list) {
          list = await createOutreachList({ spaceId, name: detail.listName });
          setLists((prev) => [list!, ...prev]);
        }
      } catch {
        // ignore
      }
    };

    const handleRenameList = async (e: Event) => {
      const detail = (e as CustomEvent<{ oldName: string; newName: string }>).detail;
      if (!detail?.oldName || !detail?.newName) return;
      setLists((prev) =>
        prev.map((l) =>
          l.name.toLowerCase() === detail.oldName.toLowerCase()
            ? { ...l, name: detail.newName }
            : l,
        ),
      );
    };

    window.addEventListener("jamot:people:addToList", handleAddToList);
    window.addEventListener("jamot:people:renameList", handleRenameList);
    return () => {
      window.removeEventListener("jamot:people:addToList", handleAddToList);
      window.removeEventListener("jamot:people:renameList", handleRenameList);
    };
  }, [spaceId, lists]);

  const handleCreate = async () => {
    const name = listName.trim();
    if (!name || !spaceId) return;
    setError(null);
    try {
      const list = await createOutreachList({ spaceId, name });
      setLists((prev) => [list, ...prev]);
      setListName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteOutreachList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
      setMembers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId((cur) => (cur === id ? null : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete list");
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!members[id]) {
      setMembersLoading((prev) => ({ ...prev, [id]: true }));
      try {
        const items = await getOutreachListMembers(id);
        setMembers((prev) => ({ ...prev, [id]: items }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load members");
      } finally {
        setMembersLoading((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleRemoveMember = async (listId: string, personId: string) => {
    setError(null);
    try {
      await removeOutreachListMembers(listId, [personId]);
      setMembers((prev) => ({
        ...prev,
        [listId]: (prev[listId] ?? []).filter((m) => m.personId !== personId),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="New list name…"
            className="h-9"
            disabled={!spaceId}
          />
          {creating ? (
            <button
              type="button"
              aria-label="Create list"
              onClick={() => void handleCreate()}
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-space-accent text-space-accent-foreground"
            >
              <ListPlus className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Button size="sm" disabled={!spaceId} onClick={() => setCreating(true)}>
          <ListPlus className="size-3.5" />
          New list
        </Button>
      </div>

      {error ? (
        <p className="shrink-0 border-b border-border px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
        {loading ? (
          <EmptyList
            icon={Loader2}
            title="Loading lists…"
            description="Fetching People lists."
          />
        ) : lists.length === 0 ? (
          <EmptyList
            icon={Users}
            title="No lists yet"
            description="Create a list to group people for outreach campaigns."
          />
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {lists.map((list) => (
              <div
                key={list.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
              >
                <button
                  type="button"
                  className="flex items-center justify-between gap-2 text-left"
                  onClick={() => void toggleExpand(list.id)}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{list.name}</span>
                    {list.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {list.description}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="px-1.5 text-[10px]">
                      {list.memberPersonIds.length}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-red-600"
                      aria-label="Delete list"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(list.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === list.id ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                        {membersLoading[list.id] ? (
                          <p className="text-xs text-muted-foreground">Loading members…</p>
                        ) : (members[list.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No members yet.</p>
                        ) : (
                          (members[list.id] ?? []).map((member) => (
                            <div
                              key={member.personId}
                              className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                            >
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-xs font-medium">
                                  {member.displayName}
                                </span>
                                {member.email ? (
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {member.email}
                                  </span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                aria-label="Remove member"
                                onClick={() =>
                                  void handleRemoveMember(list.id, member.personId)
                                }
                                className="shrink-0 text-muted-foreground hover:text-red-600"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                        <AddMembers
                          listId={list.id}
                          orgId={orgId}
                          existing={members[list.id] ?? []}
                          onAdded={(added) =>
                            setMembers((prev) => ({
                              ...prev,
                              [list.id]: [
                                ...(prev[list.id] ?? []),
                                ...added.filter(
                                  (m) =>
                                    !(prev[list.id] ?? []).some(
                                      (cur) => cur.personId === m.personId,
                                    ),
                                ),
                              ],
                            }))
                          }
                        />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddMembers({
  listId,
  orgId,
  existing,
  onAdded,
}: {
  listId: string;
  orgId: string | undefined;
  existing: OutreachListMember[];
  onAdded: (members: OutreachListMember[]) => void;
}) {
  const [people, setPeople] = useState<
    { personId: string; displayName: string; email: string | null }[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    getOrganizationMembers(orgId)
      .then((members) => {
        if (cancelled) return;
        const existingIds = new Set(existing.map((m) => m.personId));
        setPeople(
          members
            .filter((m) => !existingIds.has(m.personId))
            .map((m) => ({
              personId: m.personId,
              displayName: m.displayName,
              email: m.email,
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, listId]);

  const toggle = (personId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const addSelected = async () => {
    if (selected.size === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const personIds = [...selected];
      await addOutreachListMembers(listId, personIds);
      const added = personIds
        .map((personId) => {
          const person = people.find((p) => p.personId === personId);
          if (!person) return null;
          return {
            personId,
            actorId: personId,
            email: person.email,
            displayName: person.displayName,
            addedAt: new Date().toISOString(),
          } as OutreachListMember;
        })
        .filter((m): m is OutreachListMember => m !== null);
      onAdded(added);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add members");
    } finally {
      setLoading(false);
    }
  };

  if (!orgId || people.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
        {people.map((person) => (
          <label
            key={person.personId}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.has(person.personId)}
              onChange={() => toggle(person.personId)}
              className="size-3.5"
            />
            <span className="min-w-0 flex-1 truncate">{person.displayName}</span>
            {person.email ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {person.email}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      {selected.size > 0 ? (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => void addSelected()}
        >
          <UserPlus className="mr-1 size-3.5" />
          Add {selected.size} to list
        </Button>
      ) : null}
    </div>
  );
}