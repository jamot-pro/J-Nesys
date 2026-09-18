"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addVaultConnection,
  deleteVaultConnection,
  getVault,
  type ApiConnector,
} from "@/lib/api-client";
import { Card, Field, SectionHeading, TextInput } from "./section-primitives";

const PROVIDERS = [
  "whatsapp",
  "telegram",
  "google_calendar",
  "github",
  "stripe",
  "erp",
  "database",
  "matrix",
  "discord",
  "custom",
] as const;

export function Vault() {
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<string>("custom");
  const [ref, setRef] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const vault = await getVault();
      setConnectors(vault.connectors);
    } catch {
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getVault()
      .then((vault) => {
        if (!cancelled) setConnectors(vault.connectors);
      })
      .catch(() => {
        if (!cancelled) setConnectors([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!ref.trim() || !secret.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addVaultConnection({
        provider,
        type: "channel",
        ref: ref.trim(),
        scope: "user",
        secretPlaintext: secret,
      });
      setAdding(false);
      setRef("");
      setSecret("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add connection.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (connectionRef: string) => {
    await deleteVaultConnection(connectionRef);
    await reload();
  };

  return (
    <div>
      <SectionHeading
        title="Vault"
        description="One vault for every secret Jamot uses on your behalf."
      />

      <div className="mb-4">
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add connection
          </Button>
        ) : (
          <Card className="max-w-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium">Add a connection</p>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Close"
                onClick={() => setAdding(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Provider">
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm"
                >
                  {PROVIDERS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name" hint="Stable handle, e.g. connectors/whatsapp">
                <TextInput
                  autoFocus
                  placeholder="e.g. OpenAI, WhatsApp…"
                  value={ref}
                  onChange={(event) => setRef(event.target.value)}
                />
              </Field>
              <Field label="Secret" hint="Stored once and never shown again.">
                <TextInput
                  type="password"
                  placeholder="API key or secret"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!ref.trim() || !secret.trim() || busy}
                  onClick={() => void save()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="flex max-w-xl flex-col gap-6">
        {loading ? (
          <Card>
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          </Card>
        ) : connectors.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              No connections yet. Add one above.
            </p>
          </Card>
        ) : (
          <Card className="max-w-xl">
            <ul className="flex flex-col gap-1">
              {connectors.map((connector) => (
                <li
                  key={connector.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      connector.status === "connected" ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                  <span className="flex-1 font-medium">{connector.provider}</span>
                  <span className="text-xs text-muted-foreground">
                    {connector.credentialRef.ref}
                  </span>
                  <Badge variant="secondary">{connector.type}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    aria-label="Remove connection"
                    onClick={() => void remove(connector.credentialRef.ref)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
