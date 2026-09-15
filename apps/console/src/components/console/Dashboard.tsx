"use client";

import { useCallback, useEffect, useState } from "react";
import { getDashboardSummary, type DashboardSummary } from "@jamot/client";

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

const STAGE_LABEL: Record<string, string> = { open: "Open", won: "Won", lost: "Lost" };
const STAGE_TONE: Record<string, string> = {
  open: MUTED,
  won: "oklch(0.45 0.13 150)",
  lost: "oklch(0.5 0.16 30)",
};

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
 * Read-only by design. Every number comes from one API round trip
 * (GET /dashboard/summary) computed server-side from real rows — leads,
 * deals, agents, outreach sends — nothing sampled or fabricated. A deal is
 * created and worked from wherever it actually lives in the platform (People,
 * Outreach, LeadGen); this screen only ever reflects that state back, never
 * changes it.
 */
export function Dashboard() {
  const { organizationId, spaceId } = useOrgScope();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!summary && !error) {
    return <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading your dashboard…</p>;
  }

  const revenue = summary?.revenueByCurrency ?? [];

  return (
    <div data-copilot-region="dashboard">
      <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Dashboard</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: "62ch" }}>
        Every number below is live — leads found, agents on your team, and the deal pipeline they feed.
      </p>

      <div className="hr" style={{ margin: "var(--space-4) 0" }} />

      {error ? <p style={{ margin: "0 0 var(--space-4)", fontSize: 13, color: "var(--color-accent)" }}>{error}</p> : null}

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
              No deals yet. A deal is created from where it starts — People, Outreach, or Lead generation
              — and shows up here once it exists.
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
                  <span
                    style={{
                      flex: "none",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: STAGE_TONE[deal.stage] ?? MUTED,
                    }}
                  >
                    {STAGE_LABEL[deal.stage] ?? deal.stage}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
