"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
  ChevronDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { Card, Field, SectionHeading, TextInput } from "./section-primitives";
import { ModelPicker } from "./model-picker";
import {
  addProviderModel,
  createModelProvider,
  deleteModelProvider,
  deleteProviderModel,
  listModelProviders,
  setProviderModelEnabled,
  testModelProvider,
  updateModelProvider,
  type ApiModelProvider,
  getSpaceSettings,
  updateSpaceSettings,
} from "@/lib/api-client";

function statusBadge(provider: ApiModelProvider) {
  if (provider.status === "ok") {
    return <Badge>Connected</Badge>;
  }
  if (provider.status === "error") {
    return <Badge variant="secondary">Error</Badge>;
  }
  return <Badge variant="secondary">Untested</Badge>;
}

function ProviderCard({
  provider,
  canEdit,
  onChanged,
}: {
  provider: ApiModelProvider;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualModel, setManualModel] = useState("");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editName, setEditName] = useState(provider.name);
  const [editBaseUrl, setEditBaseUrl] = useState(provider.baseUrl);
  const [editApiKey, setEditApiKey] = useState("");

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = () =>
    run(async () => {
      await updateModelProvider(provider.id, {
        name: editName.trim() || provider.name,
        baseUrl: editBaseUrl.trim() || provider.baseUrl,
        apiKey: editApiKey.trim() || undefined,
      });
      setEditing(false);
      setEditApiKey("");
    });

  return (
    <Card>
      {/* Header — clickable to expand/collapse */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2 hover:bg-muted/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{provider.name}</p>
          <p className="truncate text-xs text-muted-foreground">{provider.baseUrl}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge(provider)}
          {canEdit ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => testModelProvider(provider.id));
                }}
                title="Test connection and refresh models"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing((v) => !v);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => deleteModelProvider(provider.id));
                }}
                aria-label={`Remove ${provider.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null}
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </div>

      {expanded && (
        <>
          {provider.status === "error" && provider.lastError ? (
            <p className="mt-2 text-xs text-destructive">{provider.lastError}</p>
          ) : null}
          {provider.lastTestedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last tested {new Date(provider.lastTestedAt).toLocaleString()}
            </p>
          ) : null}

          {editing ? (
            <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
              <Field label="Provider name">
                <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Field>
              <Field label="Base URL">
                <TextInput
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                />
              </Field>
              <Field label="API key" hint="Leave blank to keep the current key.">
                <TextInput
                  type="password"
                  autoComplete="off"
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void saveEdit()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save & re-test
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Models ({provider.models.filter((m) => m.enabled).length}/
              {provider.models.length} enabled)
            </p>
            {provider.models.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No models yet — test the connection to discover them, or add one
                manually below.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {provider.models.map((model) => (
                  <li key={model.id} className="flex items-center gap-2 py-1">
                    <Switch
                      checked={model.enabled}
                      disabled={!canEdit || busy}
                      ariaLabel={`Enable ${model.modelId}`}
                      onChange={(next) =>
                        void run(() =>
                          setProviderModelEnabled(provider.id, model.id, next),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {model.modelId}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {model.discovered ? "discovered" : "manual"}
                    </span>
                    {!model.discovered && canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => deleteProviderModel(provider.id, model.id))
                        }
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-red-600"
                        aria-label={`Remove ${model.modelId}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value)}
                  placeholder="Add a model manually (e.g. gpt-4o)"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-space-accent"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !manualModel.trim()}
                  onClick={() =>
                    void run(async () => {
                      await addProviderModel(provider.id, manualModel.trim());
                      setManualModel("");
                    })
                  }
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </>
      )}
    </Card>
  );
}

export function ModelsSection() {
  const { space } = useAppShell();
  const { user } = useAuth();
  const organizationId = space.organizationId ?? null;
  const isAdmin = space.role === "owner" || space.role === "admin";

  // The real space id for per-space settings. Org spaces use the workspace's
  // space id; the personal space's `space.id` is the literal "personal", so we
  // resolve the actor's real personal space id instead.
  const settingsSpaceId =
    space.kind === "organization"
      ? space.spaceId ?? space.id
      : user?.actor?.personalSpaceId ?? null;

  const [providers, setProviders] = useState<ApiModelProvider[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [shareWithOrg, setShareWithOrg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Orchestrator model (per-space setting) */
  const [orchestratorModel, setOrchestratorModel] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!settingsSpaceId) return;
    getSpaceSettings(settingsSpaceId)
      .then((s) => setOrchestratorModel(s.orchestratorModel ?? null))
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [settingsSpaceId]);

  const saveOrchestratorModel = async (value: string | null) => {
    if (!settingsSpaceId) return;
    setOrchestratorModel(value);
    setSavingSettings(true);
    try {
      await updateSpaceSettings(settingsSpaceId, { orchestratorModel: value });
    } catch {
      // Revert on error — user keeps old selection shown
    } finally {
      setSavingSettings(false);
    }
  };

  const reload = useCallback(async () => {
    try {
      setProviders(await listModelProviders(organizationId ?? undefined));
    } catch {
      setProviders([]);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim()) {
      setError("Provider name, base URL and API key are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { test } = await createModelProvider({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        organizationId: shareWithOrg && organizationId ? organizationId : null,
      });
      setName("");
      setBaseUrl("");
      setApiKey("");
      setShowAdd(false);
      if (!test.ok) {
        setError(
          `Provider saved, but the connection test failed: ${test.error ?? "unknown error"}. You can re-test from the provider card.`,
        );
      }
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add provider.");
    } finally {
      setBusy(false);
    }
  };

  const personal = (providers ?? []).filter((p) => !p.ownerOrganizationId);
  const org = (providers ?? []).filter((p) => Boolean(p.ownerOrganizationId));

  return (
    <div>
      <SectionHeading
        title="Models"
        description="Connect any OpenAI-compatible endpoint — OpenAI, OpenRouter, or your own gateway. Keys are stored encrypted and never shown again. Enabled models power chat and automation."
      />

      <div className="flex max-w-2xl flex-col gap-6">
        {/* General orchestrator (main chat) */}
        <Field label="General orchestrator (main chat)" hint="Which enabled model the main CopilotKit chatbox uses. `Auto` picks the first reachable provider with an enabled model.">
          {loadingSettings ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ModelPicker
              organizationId={organizationId}
              value={orchestratorModel}
              onChange={(v) => void saveOrchestratorModel(v)}
              disabled={savingSettings}
            />
          )}
        </Field>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Providers</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
            <PlugZap className="size-3.5" /> Add provider
          </Button>
        </div>

        {showAdd ? (
          <Card className="flex flex-col gap-3">
            <Field label="Provider name" hint="Anything you like — e.g. “OpenRouter”.">
              <TextInput
                value={name}
                placeholder="My OpenAI-compatible provider"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Base URL" hint="OpenAI-compatible API root.">
              <TextInput
                value={baseUrl}
                placeholder="https://openrouter.ai/api/v1"
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </Field>
            <Field label="API key / token">
              <TextInput
                type="password"
                autoComplete="off"
                value={apiKey}
                placeholder="sk-…"
                onChange={(e) => setApiKey(e.target.value)}
              />
            </Field>
            {organizationId && isAdmin ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={shareWithOrg}
                  onChange={(e) => setShareWithOrg(e.target.checked)}
                  className="size-3.5 rounded border-border"
                />
                Share with organization
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void add()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Test & connect
              </Button>
            </div>
          </Card>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {providers === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : providers.length === 0 && !showAdd ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No model providers configured yet. Add one to power chat and
            automation — the connection is tested live and its models are
            discovered automatically.
          </p>
        ) : (
          <>
            {personal.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                canEdit
                onChanged={() => void reload()}
              />
            ))}
            {organizationId && org.length > 0 ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold">
                  Organization{isAdmin ? "" : " (view only)"}
                </h3>
                {org.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    canEdit={isAdmin}
                    onChanged={() => void reload()}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
