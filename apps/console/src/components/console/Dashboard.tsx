"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDeal,
  getDashboardSummary,
  updateDeal,
  type Deal,
  type DealStage,
  type DashboardSummary,
} from "@jamot/client";

import { useOrgScope } from "../console-context";

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";
const UPPER = {
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
} as const;

const CARD: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const STAGES: { id: DealStage; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

/** How often the dashboard re-reads the summary. There is no push channel
 * for these numbers yet, and a 20s-stale count is a better tradeoff than
 * hammering the API on every tile render. */
const POLL_MS = 20_000;

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      amount,
    );
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "oklch(0.45 0.13 150)"
      : tone === "negative"
        ? "oklch(0.5 0.16 30)"
        : "var(--color-text)";
  return (
    <div style={CARD}>
      <span style={UPPER}>{label}</span>
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, color, lineHeight: 1 }}>
        {value}
      </span>
      {hint ? <span style={{ fontSize: 12, color: MUTED }}>{hint}</span> : null}
    </div>
  );
}

/**
 * The console homepage: a realtime sales dashboard replacing Discover.
 *
 * Every number here comes from one API round trip (GET /dashboard/summary)
 * computed server-side from real rows — leads, deals, agents, outreach sends.
 * There is nothing sampled or fabricated: a quiet space legitimately shows
 * zeros, and a busy one moves as the underlying data changes, picked up by
 * the poll below.
 */
export function Dashboard() {
  const { organizationId, spaceId } = useOrgScope();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await getDashboardSummary(spaceId, organizationId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard.");
    }
  }, [spaceId, organizationId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function changeStage(deal: Deal, stage: DealStage) {
    setSummary((current) =>
      current
        ? {
            ...current,
            recentDeals: current.recentDeals.map((d) => (d.id === deal.id ? { ...d, stage } : d)),
          }
        : current,
    );
    try {
      await updateDeal(deal.id, { stage });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that deal.");
      await load();
    }
  }

  async function submitNewDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!newDealTitle.trim()) return;
    setBusy(true);
    try {
      await createDeal({
        spaceId,
        organizationId,
        title: newDealTitle.trim(),
        valueAmount: newDealValue ? Number(newDealValue) : 0,
      });
      setNewDealTitle("");
      setNewDealValue("");
      setNewDealOpen(false);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that deal.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary && !error) {
    return <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading your dashboard…</p>;
  }

  const revenue = summary?.revenueByCurrency ?? [];

  return (
    <div data-copilot-region="dashboard">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
            Every number below is live — leads found, agents on your team, and the deal pipeline they feed.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewDealOpen((v) => !v)}>
          {newDealOpen ? "Cancel" : "+ New deal"}
        </button>
      </div>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? <p style={{ margin: "0 0 var(--space-4)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p> : null}

      {newDealOpen ? (
        <form
          onSubmit={submitNewDeal}
          style={{ ...CARD, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-4)" }}
        >
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label htmlFor="deal-title">Deal</label>
            <input
              className="input"
              id="deal-title"
              placeholder="e.g. Acme Corp — annual plan"
              value={newDealTitle}
              onChange={(e) => setNewDealTitle(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="deal-value">Value (USD)</label>
            <input
              className="input"
              id="deal-value"
              type="number"
              min={0}
              placeholder="0"
              value={newDealValue}
              onChange={(e) => setNewDealValue(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}

      {summary ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: "var(--space-3)",
            }}
          >
            <Tile label="Leads generated" value={summary.leadsGenerated} />
            <Tile label="Leads enriched" value={summary.leadsEnriched} />
            <Tile label="Hot leads" value={summary.hotLeads} hint="Qualified, not yet converted" />
            <Tile label="Sales people" value={summary.salesPeople} hint="Agents on this team" />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: "var(--space-3)",
              marginTop: "var(--space-3)",
            }}
          >
            <Tile label="Deals open" value={summary.dealsOpen} />
            <Tile label="Deals won" value={summary.dealsWon} tone="positive" />
            <Tile label="Deals lost" value={summary.dealsLost} tone="negative" />
            <Tile
              label="Revenue"
              value={
                revenue.length === 0
                  ? formatMoney(0, "USD")
                  : revenue.map((r) => formatMoney(r.amount, r.currency)).join(" · ")
              }
              hint="Sum of won deals"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: "var(--space-3)",
              marginTop: "var(--space-3)",
            }}
          >
            <Tile label="Active campaigns" value={summary.outreachCampaignsActive} />
            <Tile label="Outreach sent" value={summary.outreachSent} />
          </div>

          <div className="hr" style={{ margin: "var(--space-5) 0 var(--space-4)" }} />

          <span style={UPPER}>Recent deals</span>
          {summary.recentDeals.length === 0 ? (
            <p style={{ margin: "var(--space-3) 0 0", fontSize: 13, color: MUTED }}>
              No deals yet. Add one above, or bring a lead over from People once it is worth pursuing.
            </p>
          ) : (
            <section
              style={{
                marginTop: "var(--space-3)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg)",
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden",
              }}
            >
              {summary.recentDeals.map((deal, index) => (
                <div
                  key={deal.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
                    borderTop: index === 0 ? "none" : "1px solid var(--color-divider)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: "var(--font-heading)",
                      fontWeight: 700,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deal.title}
                  </span>
                  <span style={{ fontSize: 13, color: MUTED, flex: "none" }}>
                    {formatMoney(deal.valueAmount, deal.currency)}
                  </span>
                  <select
                    className="input"
                    aria-label={`Stage for ${deal.title}`}
                    style={{ height: 32, width: "auto", fontSize: 12, flex: "none" }}
                    value={deal.stage}
                    onChange={(e) => void changeStage(deal, e.target.value as DealStage)}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
