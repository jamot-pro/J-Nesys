"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addVaultConnection,
  createComposioConnection,
  deleteComposioConnection,
  executeComposioTool,
  getComposioKeyConfigured,
  listComposioConnections,
  listComposioToolkits,
  listConnectionTools,
  setComposioKey,
  type ComposioConnection,
  type ComposioTool,
  type ComposioToolkit,
} from "@/lib/api-client";
import { Card, Field, SectionHeading, TextInput } from "./section-primitives";
import { useActiveOrg } from "./use-active-org";

type ScopeChoice = "user" | "organization";

export function ComposioConnectors({ mode }: { mode: "personal" | "org" }) {
  const { isOrg, organizationId, isAdmin } = useActiveOrg();
  const effectiveOrg = mode === "org" ? organizationId : null;

  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [toolkitsError, setToolkitsError] = useState(false);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeChoice>(effectiveOrg ? "user" : "user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgKeyOpen, setOrgKeyOpen] = useState(false);
  const [orgKeyValue, setOrgKeyValue] = useState("");
  const [orgKeyBusy, setOrgKeyBusy] = useState(false);

  const [keyConfigured, setKeyConfigured] = useState(true);
  const [globalKeyOpen, setGlobalKeyOpen] = useState(false);
  const [globalKeyValue, setGlobalKeyValue] = useState("");
  const [globalKeyBusy, setGlobalKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tools, setTools] = useState<Record<string, ComposioTool[]>>({});
  const [toolsLoading, setToolsLoading] = useState<Record<string, boolean>>({});
  const [mcpResult, setMcpResult] = useState<Record<string, string>>({});
  const [execResults, setExecResults] = useState<Record<string, string>>({});
  const [execBusy, setExecBusy] = useState<Record<string, boolean>>({});

  const reloadToolkits = useCallback(async () => {
    try {
      setToolkits(await listComposioToolkits());
      setToolkitsError(false);
    } catch {
      setToolkitsError(true);
    }
  }, []);

  const reloadConnections = useCallback(async () => {
    try {
      setConnections(await listComposioConnections(effectiveOrg ?? undefined));
    } catch {
      setConnections([]);
    }
  }, [effectiveOrg]);

  const reload = useCallback(async () => {
    setLoading(true);
    await Promise.all([reloadToolkits(), reloadConnections()]);
    setLoading(false);
  }, [reloadToolkits, reloadConnections]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await Promise.all([
        getComposioKeyConfigured().then(
          (r) => ({ ok: true as const, configured: r.configured }),
          () => ({ ok: false as const, configured: true }),
        ),
        listComposioToolkits().then(
          (items) => ({ ok: true as const, items }),
          () => ({ ok: false as const, items: [] as ComposioToolkit[] }),
        ),
        listComposioConnections(effectiveOrg ?? undefined).then(
          (items) => ({ ok: true as const, items }),
          () => ({ ok: false as const, items: [] as ComposioConnection[] }),
        ),
      ]);
      if (cancelled) return;
      const [keyResult, toolkitResult, connectionResult] = results;
      setKeyConfigured(keyResult.configured);
      setToolkits(toolkitResult.items);
      setToolkitsError(!toolkitResult.ok);
      setConnections(connectionResult.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrg]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("composio") === "success") {
      void reload();
    }
    if (params.get("composio") === "error") {
      setError(params.get("message") ?? "Composio connection failed.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [reload]);

  const startConnect = async (toolkit: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await createComposioConnection({
        toolkit,
        sharing: scope,
        organizationId: effectiveOrg,
      });
      window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
      setConnectingToolkit(toolkit);
      let attempts = 0;
      const poll = window.setInterval(async () => {
        attempts += 1;
        const current = await listComposioConnections(effectiveOrg ?? undefined);
        setConnections(current);
        const found = current.find(
          (c) => c.toolkit === toolkit && c.status === "connected",
        );
        if (found || attempts >= 30) {
          window.clearInterval(poll);
          setConnectingToolkit(null);
        }
      }, 2500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start connection.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (connectorId: string) => {
    await deleteComposioConnection(connectorId);
    await reloadConnections();
  };

  const toggleTools = async (connector: ComposioConnection) => {
    const isOpen = expanded[connector.id];
    if (!isOpen && !tools[connector.id]) {
      setToolsLoading((prev) => ({ ...prev, [connector.id]: true }));
      try {
        const items = await listConnectionTools(connector.id);
        setTools((prev) => ({ ...prev, [connector.id]: items }));
      } catch (cause) {
        setMcpResult((prev) => ({
          ...prev,
          [connector.id]: cause instanceof Error ? cause.message : "could not load tools",
        }));
      } finally {
        setToolsLoading((prev) => ({ ...prev, [connector.id]: false }));
      }
    }
    setExpanded((prev) => ({ ...prev, [connector.id]: !isOpen }));
  };

  const runTool = async (connectorId: string, tool: ComposioTool) => {
    setExecBusy((prev) => ({ ...prev, [tool.slug]: true }));
    try {
      const result = await executeComposioTool({ connectorId, tool: tool.slug });
      setExecResults((prev) => ({
        ...prev,
        [tool.slug]: JSON.stringify(result.data ?? {}, null, 2),
      }));
    } catch (cause) {
      setExecResults((prev) => ({
        ...prev,
        [tool.slug]: cause instanceof Error ? cause.message : "tool execution failed",
      }));
    } finally {
      setExecBusy((prev) => ({ ...prev, [tool.slug]: false }));
    }
  };

  const saveOrgKey = async () => {
    if (!effectiveOrg || !orgKeyValue.trim()) return;
    setOrgKeyBusy(true);
    setError(null);
    try {
      await addVaultConnection({
        provider: "custom",
        type: "data",
        ref: `composio/api-key/${effectiveOrg}`,
        scope: "organization",
        ownerOrganizationId: effectiveOrg,
        secretPlaintext: orgKeyValue.trim(),
      });
      setOrgKeyOpen(false);
      setOrgKeyValue("");
      await reloadToolkits();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save API key.");
    } finally {
      setOrgKeyBusy(false);
    }
  };

  const saveGlobalKey = async () => {
    if (!globalKeyValue.trim()) return;
    setGlobalKeyBusy(true);
    setKeyError(null);
    try {
      await setComposioKey(globalKeyValue.trim());
      setGlobalKeyOpen(false);
      setGlobalKeyValue("");
      setKeyConfigured(true);
      await reloadToolkits();
    } catch (cause) {
      setKeyError(cause instanceof Error ? cause.message : "Could not save Composio API key.");
    } finally {
      setGlobalKeyBusy(false);
    }
  };

  const filtered = search.trim()
    ? toolkits.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.key.toLowerCase().includes(search.toLowerCase()),
      )
    : toolkits;

  return (
    <div>
      <SectionHeading
        title="Connectors"
        description={
          mode === "personal"
            ? "Third-party accounts Jamot can use on your behalf."
            : "Third-party accounts available to this organization."
        }
      />

      {!isOrg && effectiveOrg === null && mode === "org" ? (
        <Card className="max-w-xl">
          <p className="text-sm text-muted-foreground">
            Open an organization workspace to manage its connectors.
          </p>
        </Card>
      ) : loading ? (
        <Card className="max-w-xl">
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        </Card>
      ) : toolkitsError || (toolkits.length === 0 && !connectingToolkit) ? (
        <Card className="max-w-xl">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {toolkitsError
                ? "Could not load Composio connectors."
                : "No Composio API key is configured yet. Set one to browse and connect the available connectors."}
            </p>

            {!keyConfigured ? (
              globalKeyOpen ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <Field label="Composio API key" hint="Stored encrypted as the platform key. Get it from app.composio.dev.">
                    <TextInput
                      autoFocus
                      type="password"
                      placeholder="composio_…"
                      value={globalKeyValue}
                      onChange={(event) => setGlobalKeyValue(event.target.value)}
                    />
                  </Field>
                  {keyError ? <p className="text-sm text-destructive">{keyError}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setGlobalKeyOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!globalKeyValue.trim() || globalKeyBusy}
                      onClick={() => void saveGlobalKey()}
                    >
                      {globalKeyBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" onClick={() => setGlobalKeyOpen(true)}>
                  <KeyRound className="size-4" />
                  Set Composio API key
                </Button>
              )
            ) : null}

            {isAdmin && mode === "org" && effectiveOrg ? (
              orgKeyOpen ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <Field label="Composio API key" hint="Stored as an organization secret (composio/api-key).">
                    <TextInput
                      autoFocus
                      type="password"
                      placeholder="composio_…"
                      value={orgKeyValue}
                      onChange={(event) => setOrgKeyValue(event.target.value)}
                    />
                  </Field>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOrgKeyOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!orgKeyValue.trim() || orgKeyBusy}
                      onClick={() => void saveOrgKey()}
                    >
                      {orgKeyBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setOrgKeyOpen(true)}>
                  <KeyRound className="size-4" />
                  Set organization API key
                </Button>
              )
            ) : null}
          </div>
        </Card>
      ) : (
        <>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

          <div className="mb-4 flex max-w-xl items-center gap-2">
            <TextInput
              placeholder="Search toolkits (GitHub, Gmail, Slack…)"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {mode === "org" && effectiveOrg && isAdmin ? (
              <Button variant="ghost" size="sm" onClick={() => setOrgKeyOpen(!orgKeyOpen)}>
                <KeyRound className="size-4" />
              </Button>
            ) : null}
          </div>

          {orgKeyOpen && mode === "org" && effectiveOrg && isAdmin ? (
            <Card className="mb-4 max-w-xl">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Organization Composio API key</p>
                <TextInput
                  type="password"
                  placeholder="composio_…"
                  value={orgKeyValue}
                  onChange={(event) => setOrgKeyValue(event.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOrgKeyOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={!orgKeyValue.trim() || orgKeyBusy} onClick={() => void saveOrgKey()}>
                    {orgKeyBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

<div className="mb-6 flex max-w-xl items-center gap-2">
            {mode === "org" && effectiveOrg ? (
              <Field label="Scope" className="w-56">
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value as ScopeChoice)}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm"
                >
                  <option value="user">Keep private to me</option>
                  <option value="organization">Share to organization</option>
                </select>
              </Field>
            ) : (
              <Badge variant="secondary">Personal</Badge>
            )}
          </div>

          <div className="mb-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((toolkit) => {
              const isConnecting = connectingToolkit === toolkit.key;
              return (
                <Card key={toolkit.key}>
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-medium">{toolkit.name}</p>
                      {toolkit.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {toolkit.description}
                        </p>
                      ) : null}
                    </div>
                    <Button size="sm" disabled={busy || isConnecting} onClick={() => void startConnect(toolkit.key)}>
                      {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      {isConnecting ? "Waiting for auth…" : "Connect"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {connections.length > 0 ? (
            <Card className="max-w-3xl">
              <p className="mb-3 text-sm font-medium">Your connections</p>
              <ul className="flex flex-col gap-2">
                {connections.map((connector) => (
                  <li key={connector.id} className="rounded-md border border-border">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        aria-label="Expand tools"
                        onClick={() => void toggleTools(connector)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded[connector.id] ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          connector.status === "connected" ? "bg-emerald-500" : "bg-amber-500",
                        )}
                      />
                      <span className="flex-1 text-sm font-medium">{connector.toolkit}</span>
                      <Badge variant="secondary">
                        {connector.sharing === "organization"
                          ? "Org shared"
                          : mode === "org"
                            ? "Private"
                            : "Personal"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{connector.status}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label="Disconnect"
                        onClick={() => void disconnect(connector.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {expanded[connector.id] ? (
                      <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
                        {toolsLoading[connector.id] ? (
                          <p className="text-xs text-muted-foreground">Loading tools…</p>
                        ) : (tools[connector.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No tools available.</p>
                        ) : (
                          (tools[connector.id] ?? []).map((tool) => (
                            <div key={tool.slug} className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
                              <div className="flex items-center gap-2">
                                <span className="flex-1 text-xs font-medium">{tool.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={Boolean(execBusy[tool.slug])}
                                  onClick={() => void runTool(connector.id, tool)}
                                >
                                  {execBusy[tool.slug] ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Play className="size-3.5" />
                                  )}
                                  Run
                                </Button>
                              </div>
                              {execResults[tool.slug] ? (
                                <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-[10px] text-muted-foreground">
                                  {execResults[tool.slug]}
                                </pre>
                              ) : null}
                            </div>
                          ))
                        )}
                        {mcpResult[connector.id] ? (
                          <p className="text-xs text-destructive">{mcpResult[connector.id]}</p>
                        ) : null}
                        <button
                          type="button"
                          className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => void listConnectionTools(connector.id)}
                        >
                          <ExternalLink className="size-3" />
                          Refresh tools
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}