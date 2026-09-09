"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, MessageCircle, Plus, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOrgSpaces } from "@/lib/org-spaces";
import type { OrgSpaceRef } from "@/lib/org-spaces";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  logoutAccount,
  resetPairing,
} from "@/components/whatsapp/wa-api";
import type { WaAccount } from "@/components/whatsapp/wa-data";
import { Card, SectionHeading } from "./section-primitives";

function statusLabel(status: WaAccount["status"], connection?: WaAccount["connection"]): string {
  if (status === "connected" || connection === "open") return "Connected";
  if (status === "pairing" || status === "connecting" || connection === "connecting")
    return "Pairing…";
  if (status === "error") return "Error";
  return "Offline";
}

function QrCode({ qr }: { qr: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(qr, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qr]);
  if (!dataUrl) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Waiting for code…
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt="WhatsApp pairing QR code"
      className="rounded-lg border border-border bg-white p-2"
    />
  );
}

export function ChannelsSection() {
  const [orgs, setOrgs] = useState<OrgSpaceRef[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrAccount, setQrAccount] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listOrgSpaces()
      .then((items) => {
        if (cancelled) return;
        setOrgs(items);
        if (items.length > 0) setOrgId(items[0]!.spaceId);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load organizations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const items = await listAccounts(orgId);
        if (!cancelled) setAccounts(items);
      } catch {
        if (!cancelled) setError("Could not load WhatsApp accounts.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orgId]);

  const selectedOrg = orgs.find((o) => o.spaceId === orgId);

  const handleAdd = async () => {
    if (!orgId || !newLabel.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const account = await createAccount(orgId, newLabel.trim());
      setNewLabel("");
      setAccounts((prev) => [...prev, account]);
      setQrAccount(account.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add channel.");
    } finally {
      setAdding(false);
    }
  };

  const handleReset = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await resetPairing(id);
      setQrAccount(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset pairing.");
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await logoutAccount(id);
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "offline" } : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not logout.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (qrAccount === id) setQrAccount(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove channel.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Channels"
        description="WhatsApp accounts linked to this organization. Add one and scan the QR to connect it."
      />

      <Card className="mb-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Organization</span>
          <select
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              setQrAccount(null);
            }}
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

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card className="mb-4">
        <p className="mb-2 text-sm font-medium">Add a channel</p>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Channel name (e.g. Sales WhatsApp)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
          />
          <Button disabled={adding || !orgId} onClick={() => void handleAdd()}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No WhatsApp channels linked yet{selectedOrg ? ` for ${selectedOrg.name}` : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <Card key={account.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MessageCircle className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.phone ?? "Not paired"} · {statusLabel(account.status, account.connection)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={busy === account.id}
                    onClick={() => void handleReset(account.id)}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={busy === account.id}
                    onClick={() => void handleLogout(account.id)}
                  >
                    Logout
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    aria-label="Remove channel"
                    disabled={busy === account.id}
                    onClick={() => void handleDelete(account.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {qrAccount === account.id &&
              account.status !== "connected" &&
              account.connection !== "open" ? (
                <div className="flex items-start gap-3 border-t border-border pt-3">
                  <div className="shrink-0">
                    {account.qr ? (
                      <QrCode qr={account.qr} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Waiting for code…
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <p>
                      Scan with WhatsApp on your phone: <b>Settings → Linked devices → Link a device</b>.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 self-start text-xs"
                      onClick={() => setQrAccount(null)}
                    >
                      <X className="size-3.5" /> Dismiss
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
