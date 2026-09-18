"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { cn } from "@/lib/utils";
import {
  approvePaymentIntent,
  confirmPaymentIntent,
  listPaymentIntents,
  listPaymentRecords,
  listProducts,
  listPurchaseOrders,
  type ApiPaymentIntent,
  type ApiPaymentRecord,
  type ApiPurchaseOrder,
} from "@/lib/api-client";

function shortId(id: string): string {
  return id.slice(0, 8);
}

function intentLabel(status: string): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "processing":
      return "Processing";
    case "paid":
      return "Paid";
    case "refunded":
      return "Refunded";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function FinanceWorkspace() {
  const { space } = useAppShell();
  const [intents, setIntents] = useState<ApiPaymentIntent[]>([]);
  const [records, setRecords] = useState<ApiPaymentRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ApiPurchaseOrder[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ApiPaymentIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [allIntents, allOrders, products] = await Promise.all([
        listPaymentIntents(space.spaceId),
        listPurchaseOrders(space.spaceId),
        listProducts(space.spaceId).catch(() => []),
      ]);
      setIntents(allIntents);
      setPurchaseOrders(allOrders);
      setProductNames(
        Object.fromEntries(products.map((p) => [p.id, p.name])),
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "failed to load";
      setError(reason);
    }
  }, [space.spaceId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [allIntents, allOrders, products] = await Promise.all([
          listPaymentIntents(space.spaceId),
          listPurchaseOrders(space.spaceId),
          listProducts(space.spaceId).catch(() => []),
        ]);
        if (cancelled) return;
        setIntents(allIntents);
        setPurchaseOrders(allOrders);
        setProductNames(
          Object.fromEntries(products.map((p) => [p.id, p.name])),
        );
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const reason = err instanceof Error ? err.message : "failed to load";
        setError(reason);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [space.spaceId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    listPaymentRecords(selected.id)
      .then((items) => {
        if (!cancelled) setRecords(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      await refresh();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "operation failed";
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const orderTotal = (orderId: string | null): number | null =>
    purchaseOrders.find((order) => order.id === orderId)?.total ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-medium">Finance · Supplier payments</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => void refresh()}
        >
          <RotateCcw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="truncate">{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="truncate">{message}</span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {intents.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No payment intents yet. Approve a purchase order to create one.
              </p>
            ) : null}
            {intents
              .slice()
              .sort((a, b) => b.id.localeCompare(a.id))
              .map((intent) => (
                <button
                  key={intent.id}
                  type="button"
                  onClick={() => setSelected(intent)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted",
                    selected?.id === intent.id && "bg-muted/70",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      #{shortId(intent.id)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {intent.currency} {intent.estimatedAmount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {intentLabel(intent.status)}
                    </span>
                    <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-semibold uppercase">
                      {intent.provider}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <ShieldAlert className="size-6" />
              <p>Select a payment intent to review or act on it.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-semibold">
                    #{shortId(selected.id)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    PO {selected.purchaseOrderId ? shortId(selected.purchaseOrderId) : "—"}
                    {" · "}
                    {intentLabel(selected.status)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold">
                    {selected.currency} {selected.estimatedAmount}
                  </p>
                  {selected.requiresApproval ? (
                    <span className="text-xs text-amber-600">
                      Requires human approval
                    </span>
                  ) : null}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">PO total</dt>
                  <dd className="mt-1 font-medium">
                    {orderTotal(selected.purchaseOrderId) ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Provider</dt>
                  <dd className="mt-1 font-medium uppercase">{selected.provider}</dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Buyer</dt>
                  <dd className="mt-1 truncate font-mono text-xs">
                    {shortId(selected.buyerOrganizationId)}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Seller</dt>
                  <dd className="mt-1 truncate font-mono text-xs">
                    {shortId(selected.sellerOrganizationId)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {selected.status === "pending_approval" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => approvePaymentIntent(selected.id),
                        "Intent approved",
                      )
                    }
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Approve
                  </Button>
                ) : null}
                {selected.status === "approved" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => confirmPaymentIntent(selected.id),
                        "Payment settled on ledger",
                      )
                    }
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Confirm payment
                  </Button>
                ) : null}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Settlement records
                </h4>
                {records.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No settlement records yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="truncate text-muted-foreground">
                          Settled {record.currency} {record.paidAmount}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(record.settledAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function productLabel(
  productId: string,
  names: Record<string, string>,
): string {
  return names[productId] ?? shortId(productId);
}