import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";

import { API_URL } from "@/components/auth/auth-context";
import { useActiveOrg } from "./use-active-org";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface GoogleStatus {
  connected: boolean;
  connectorId?: string;
  status?: string;
  email?: string | null;
  lastSyncAt?: string | null;
  contactsSynced?: number;
  sendersSynced?: number;
}

/**
 * Google connector card — People API import + Gmail sender ingestion.
 * Users only see "Google"; OAuth scopes and API details stay hidden.
 */
export function GoogleConnectorCard() {
  const { space } = useActiveOrg();
  const spaceId = space.spaceId ?? null;
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(spaceId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) {
      setLoading(false);
      return;
    }
    try {
      setStatus(await api<GoogleStatus>(`/api/google/status?spaceId=${spaceId}`));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result) return;
    if (result === "success") void load();
    if (result === "error") setError("Google connection failed. Please try again.");
    if (result === "denied") setError("Google access was denied.");
    window.history.replaceState({}, "", window.location.pathname);
  }, [load]);

  if (!spaceId) return null;

  const connect = () => {
    window.location.href = `${API_URL}/api/google/start?spaceId=${encodeURIComponent(spaceId)}`;
  };

  const syncNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/google/sync`, {
        method: "POST",
        body: JSON.stringify({ spaceId }),
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!status?.connectorId) return;
    setBusy(true);
    try {
      await api(`/api/google/${status.connectorId}`, { method: "DELETE" });
      setStatus({ connected: false });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-muted">
          <Plug className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Google</p>
          <p className="text-xs text-muted-foreground">
            Imports Google Contacts and reads Gmail senders into People.
          </p>
        </div>
        {status?.connected ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{status.email ?? "Google account"}</span>
          {status.lastSyncAt ? (
            <span>· last sync {new Date(status.lastSyncAt).toLocaleString()}</span>
          ) : null}
          {(status.contactsSynced ?? 0) > 0 || (status.sendersSynced ?? 0) > 0 ? (
            <span>
              · {status.contactsSynced ?? 0} contacts, {status.sendersSynced ?? 0} senders
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        {status?.connected ? (
          <>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void syncNow()}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={connect}
            className="rounded-md bg-space-accent px-3 py-1.5 text-xs font-medium text-space-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Connect Google
          </button>
        )}
      </div>
    </div>
  );
}
