"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import {
  createLeadList,
  deleteLeadList,
  enrichLead,
  listLeadLists,
  listLeadListLeads,
  listLeadProviders,
  runLeadList,
  type LeadArea,
  type LeadList,
  type LeadPersona,
  type LeadProviderView,
  type LeadView,
} from "@/lib/api-client";
import { LeadMapAreaPicker } from "./LeadMapAreaPicker";
import { LeadConfigPanel } from "./LeadConfigPanel";
import { LeadResultsTable } from "./LeadResultsTable";

const EMPTY_PERSONA: LeadPersona = {
  titles: [],
  seniority: [],
  functions: [],
  industries: [],
  companySizes: [],
  keywords: [],
  excludeEmails: [],
  summary: "",
};

export function LeadsWorkspace() {
  const { space } = useAppShell();
  const { user } = useAuth();
  const spaceId = space.spaceId ?? user?.person?.membershipSpaceIds[0] ?? null;
  const organizationId = space.organizationId ?? null;

  const [lists, setLists] = useState<LeadList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const reloadLists = useCallback(async () => {
    if (!spaceId) {
      setLists([]);
      setLoading(false);
      return [];
    }
    try {
      const items = await listLeadLists(spaceId, organizationId);
      setLists(items);
      return items;
    } catch {
      setLists([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [spaceId, organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial list load
    void reloadLists();
  }, [reloadLists]);

  const selected = useMemo(
    () => lists.find((list) => list.id === selectedId) ?? null,
    [lists, selectedId],
  );

  if (creating && spaceId) {
    return (
      <NewResearch
        spaceId={spaceId}
        organizationId={organizationId}
        onDone={(list) => {
          setCreating(false);
          setSelectedId(list.id);
          void reloadLists();
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">Lead Lists</span>
        <Button size="sm" disabled={!spaceId} onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 size-3.5" />
          New research
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : lists.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Radar className="size-8 text-muted-foreground" />
          <p className="max-w-xs text-sm text-muted-foreground">
            No research yet. Create a Lead List — draw an area on the map, define
            the persona, and generate leads into People.
          </p>
          <Button disabled={!spaceId} onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 size-4" />
            New research
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedId(list.id)}
                className={`flex flex-col gap-0.5 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted ${
                  selectedId === list.id ? "bg-muted" : ""
                }`}
              >
                <span className="truncate text-sm font-medium">{list.name}</span>
                <span className="text-xs text-muted-foreground">
                  {list.leadCount} leads · {list.status}
                </span>
              </button>
            ))}
          </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selected ? (
              <SelectedList
                key={selected.id}
                list={selected}
                onRefresh={() => void reloadLists()}
                onDelete={async () => {
                  await deleteLeadList(selected.id);
                  setSelectedId(null);
                  void reloadLists();
                }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a Lead List to view its leads.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SelectedList({
  list,
  onRefresh,
  onDelete,
}: {
  list: LeadList;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      const items = await listLeadListLeads(list.id);
      setLeads(items);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [list.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload on list change
    void loadLeads();
  }, [loadLeads]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      await runLeadList(list.id);
      await loadLeads();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate leads");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LeadResultsTable
        list={list}
        leads={leads}
        loading={loading}
        running={running}
        onRun={() => void handleRun()}
        onEnrich={async (personId) => {
          setError(null);
          try {
            await enrichLead(list.id, personId);
            await loadLeads();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not enrich lead",
            );
          }
        }}
      />
      {error ? (
        <p className="shrink-0 border-t border-border px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => void onDelete()}
        >
          Delete list
        </Button>
      </div>
    </div>
  );
}

function NewResearch({
  spaceId,
  organizationId,
  onDone,
  onCancel,
}: {
  spaceId: string;
  organizationId: string | null;
  onDone: (list: LeadList) => void;
  onCancel: () => void;
}) {
  const [area, setArea] = useState<LeadArea | null>(null);
  const [providers, setProviders] = useState<LeadProviderView[]>([]);
  const [providerId, setProviderId] = useState("");
  const [persona, setPersona] = useState<LeadPersona>(EMPTY_PERSONA);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listLeadProviders(spaceId, organizationId)
      .then((items) => {
        setProviders(items);
        const configured = items.find((p) => p.configured);
        setProviderId((current) => current || configured?.id || items[0]?.id || "");
      })
      .catch(() => setProviders([]));
  }, [spaceId, organizationId]);

  const handleSave = async () => {
    if (!area || !name.trim() || !providerId) return;
    setSaving(true);
    setError(null);
    try {
      const list = await createLeadList({
        spaceId,
        organizationId,
        name,
        persona,
        area,
        providerId,
      });
      onDone(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">New research</span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Target area on the map
          </label>
          <LeadMapAreaPicker value={area} onChange={setArea} />
        </div>
        <LeadConfigPanel
          area={area}
          providers={providers}
          providerId={providerId}
          onProviderChange={setProviderId}
          persona={persona}
          onPersonaChange={setPersona}
          name={name}
          onNameChange={setName}
          onSave={() => void handleSave()}
          saving={saving}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}