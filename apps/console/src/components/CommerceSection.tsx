"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approvePurchaseOrder,
  fulfillPurchaseOrder,
  listPaymentIntents,
  listPurchaseOrders,
  type ApiPaymentIntent,
  type ApiPurchaseOrder,
} from "@jamot/client";

import { useOrgScope } from "./console-context";

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: currency || "EUR" });
}

/**
 * Commerce — Commerce.dc.html.
 *
 * Purchase orders can be approved and fulfilled here because those are plain
 * state transitions the API already exposes. Payment intents are READ-ONLY on
 * purpose: settlement rails are deferred by JAMOT_SPEC §76, and only `ledger`
 * is implemented, so this shows what the kernel knows without offering an
 * action the rails cannot honour.
 *
 * There is no "create order" here either — createPurchaseOrder takes a quoteId
 * produced by the RFQ flow, which this screen does not model.
 */
export function CommerceSection() {
  const { spaceId } = useOrgScope();

  const [orders, setOrders] = useState<ApiPurchaseOrder[] | null>(null);
  const [intents, setIntents] = useState<ApiPaymentIntent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [o, p] = await Promise.all([
      listPurchaseOrders(spaceId),
      listPaymentIntents(spaceId).catch(() => [] as ApiPaymentIntent[]),
    ]);
    setOrders(o);
    setIntents(p);
  }, [spaceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!cancelled) await refresh();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load commerce.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Commerce</h1>
        <p style={{ margin: "var(--space-2) 0 0", maxWidth: "62ch", opacity: 0.75, fontSize: 14 }}>
          Orders this organization is party to, and what the kernel knows about their payment.
        </p>
      </header>

      {error ? (
        <p role="alert" className="card" style={{ color: "var(--accent-ink)", marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      ) : null}

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Purchase orders {orders ? <span style={{ opacity: 0.5 }}>({orders.length})</span> : null}
        </h2>
        {orders === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : orders.length === 0 ? (
          <div className="card">
            <div className="card-kicker">Nothing yet</div>
            <div className="card-title">No purchase orders</div>
            <p className="card-body">
              Orders arrive from the RFQ flow — a quote becomes a purchase order. They cannot be
              created from this screen.
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id.slice(0, 8)}</td>
                  <td>
                    <span className={o.status === "approved" ? "tag tag-accent" : "tag tag-neutral"}>
                      {o.status}
                    </span>
                  </td>
                  <td>{o.items.length}</td>
                  <td>{money(o.total, o.currency)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {o.status === "draft" || o.status === "pending_approval" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(() => approvePurchaseOrder(o.id))}>
                        Approve
                      </button>
                    ) : null}
                    {o.status === "approved" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(() => fulfillPurchaseOrder(o.id))}>
                        Fulfil
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Payments <span style={{ opacity: 0.5 }}>({intents.length})</span>
        </h2>
        {intents.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No payment intents.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Intent</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Amount</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((p) => (
                <tr key={p.id}>
                  <td>{p.id.slice(0, 8)}</td>
                  <td>
                    <span className="tag tag-neutral">{p.status}</span>
                  </td>
                  <td>{p.provider}</td>
                  <td>{money(p.estimatedAmount, p.currency)}</td>
                  <td>{p.requiresApproval ? (p.approvedByActorId ? "approved" : "required") : "not required"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="card">
        <div className="card-kicker">Deferred by design</div>
        <div className="card-title">Payments are read-only here</div>
        <p className="card-body">
          Settlement rails (x402 / AP2) are recorded as deferred in JAMOT_SPEC §76, and only the
          internal <code>ledger</code> provider is implemented. This screen therefore reports
          payment state but offers no action that a rail could not honour.
        </p>
      </div>
    </>
  );
}
