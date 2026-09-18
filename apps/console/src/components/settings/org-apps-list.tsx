"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  getOrganizationApps,
  setOrganizationApps,
  type AppAllocation,
  type AppManifest,
} from "@/lib/api-client";
import { Switch } from "@/components/ui/switch";
import { Card } from "./section-primitives";

export function OrgAppsList({
  organizationId,
  canEdit,
}: {
  organizationId: string;
  canEdit: boolean;
}) {
  const [allocation, setAllocation] = useState<AppAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrganizationApps(organizationId)
      .then((data) => {
        if (cancelled) return;
        setAllocation(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load apps");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const apps: Array<AppManifest & { enabled: boolean }> = allocation?.apps ?? [];

  const toggleApp = async (appId: string) => {
    if (!allocation || savingId) return;
    const previous = allocation;
    const nextEnabled = previous.enabledAppIds.includes(appId)
      ? previous.enabledAppIds.filter((id) => id !== appId)
      : [...previous.enabledAppIds, appId];

    const optimistic: AppAllocation = {
      ...previous,
      enabledAppIds: nextEnabled,
      apps: previous.apps.map((app) =>
        app.id === appId ? { ...app, enabled: !app.enabled } : app,
      ),
    };
    setAllocation(optimistic);
    setError(null);
    setSavingId(appId);
    try {
      setAllocation(await setOrganizationApps(organizationId, nextEnabled));
    } catch (err) {
      setAllocation(previous);
      setError(err instanceof Error ? err.message : "Could not update apps");
    } finally {
      setSavingId(null);
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading apps…</p>;
  }

  if (apps.length === 0) {
    return (
      <Card className="max-w-xl">
        <p className="text-sm text-muted-foreground">No apps in the registry.</p>
      </Card>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-2">
      {apps.map((app) => (
        <Card key={app.id} className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{app.name}</span>
              <Badge variant="secondary" className="px-1.5 text-[10px]">
                v{app.version}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{app.description}</p>
            {app.capabilities.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {app.capabilities.slice(0, 4).map((capability) => (
                  <span
                    key={capability}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {capability}
                  </span>
                ))}
                {app.capabilities.length > 4 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{app.capabilities.length - 4} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-2">
              {savingId === app.id ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                checked={app.enabled}
                disabled={savingId !== null}
                ariaLabel={`Toggle ${app.name}`}
                onChange={() => void toggleApp(app.id)}
              />
            </div>
          ) : (
            <Badge
              variant={app.enabled ? "accent" : "secondary"}
              className="shrink-0"
            >
              {app.enabled ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </Card>
      ))}
    </div>
  );
}