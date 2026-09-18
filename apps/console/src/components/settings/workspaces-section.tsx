"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOrgSpaces } from "@/lib/org-spaces";
import type { OrgSpaceRef } from "@/lib/org-spaces";
import {
  getOrganizations,
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  type Workspace,
} from "@/lib/api-client";
import { Card, SectionHeading } from "./section-primitives";

export function WorkspacesSection({
  organizationId: fixedOrgId,
  onChanged,
}: {
  organizationId?: string;
  onChanged?: () => void;
} = {}) {
  const [orgs, setOrgs] = useState<OrgSpaceRef[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveOrgId = fixedOrgId ?? orgId;

  useEffect(() => {
    if (fixedOrgId) return;
    let cancelled = false;
    void listOrgSpaces()
      .then((items) => {
        if (cancelled) return;
        setOrgs(items);
        if (items.length > 0) setOrgId(items[0]!.spaceId);
      })
      .catch(() => {
        if (cancelled) setError("Could not load organizations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixedOrgId]);

  useEffect(() => {
    if (!effectiveOrgId) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgsList = await getOrganizations();
        const item = orgsList.find(
          (o) =>
            o.workspaces?.some((w) => w.spaceId === effectiveOrgId) ||
            o.space.id === effectiveOrgId,
        );
        if (!item || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        const ws = item.workspaces?.length
          ? item.workspaces
          : await listWorkspaces(item.organization.id);
        if (!cancelled) {
          setWorkspaces(ws);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load workspaces.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrgId]);

  const handleCreate = async () => {
    if (!effectiveOrgId || !name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const orgsList = await getOrganizations();
      const item = orgsList.find(
        (o) =>
          o.workspaces?.some((w) => w.spaceId === effectiveOrgId) ||
          o.space.id === effectiveOrgId,
      );
      if (!item) throw new Error("Organization not found");
      const workspace = await createWorkspace(item.organization.id, name.trim());
      setWorkspaces((prev) => [...prev, workspace]);
      setName("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (workspace: Workspace) => {
    setBusy(workspace.id);
    setError(null);
    try {
      const orgsList = await getOrganizations();
      const item = orgsList.find(
        (o) =>
          o.workspaces?.some((w) => w.spaceId === effectiveOrgId) ||
          o.space.id === effectiveOrgId,
      );
      if (!item) throw new Error("Organization not found");
      await deleteWorkspace(item.organization.id, workspace.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspace.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete workspace.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Workspaces"
        description="Organizations are containers; each workspace is an isolated tenant with its own data — tasks, memory, knowledge, products, WhatsApp channels and commerce. Switch workspaces in the top-left space selector to operate in each one."
      />

      {!fixedOrgId ? (
        <Card className="mb-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Organization</span>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {orgs.map((o) => (
                <option key={o.spaceId} value={o.spaceId}>
                  {o.name || o.spaceId}
                </option>
              ))}
            </select>
          </label>
        </Card>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card className="mb-4">
        <p className="mb-2 text-sm font-medium">Add a workspace</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name (e.g. Sales, Marketing, Warehouse)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />
          <Button disabled={creating || !orgId} onClick={() => void handleCreate()}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workspaces yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Layers className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{workspace.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {workspace.spaceId}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive"
                aria-label={`Delete ${workspace.name}`}
                disabled={busy === workspace.id}
                onClick={() => void handleDelete(workspace)}
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
