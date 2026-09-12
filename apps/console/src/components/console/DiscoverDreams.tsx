"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { joinDream, leaveDream, listDreams, type DreamListing } from "@jamot/client";

/** The mockup's fixed tabs, kept as the spine; anything a dream declares that
 *  is not one of them is appended, so a new category is never invisible. */
const BASE_CATS = ["All", "Energy", "Food", "Education", "Circular", "Cities", "Commerce"];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const MUTED = "color-mix(in srgb, var(--color-text) 74%, transparent)";

/** Discover Dreams — a direct port of OrgConsole.dc.html's `discover-dreams`
 * region (lines 171–228), styles verbatim. */
export function DiscoverDreams() {
  const [cat, setCat] = useState("All");
  const [dreams, setDreams] = useState<DreamListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDreams(await listDreams());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dreams.");
      setDreams([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cats = useMemo(() => {
    const extra = (dreams ?? [])
      .map((d) => d.category)
      .filter((c) => c && !BASE_CATS.includes(c));
    return [...BASE_CATS, ...new Set(extra)];
  }, [dreams]);

  const results = (dreams ?? []).filter((d) => cat === "All" || d.category === cat);

  const toggleJoin = async (dream: DreamListing) => {
    setPending(dream.organizationId);
    try {
      if (dream.joined) await leaveDream(dream.organizationId);
      else await joinDream(dream.organizationId);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div data-copilot-region="discover-dreams">
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-ink)" }}>
            Discover
          </span>
          <h1 style={{ margin: "6px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Dreams looking for people.
          </h1>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: 15, lineHeight: 1.6, color: MUTED, maxWidth: "60ch" }}>
            Every dream published on Jamot. Join one and it appears in your rail — then you can build and maintain the
            agents that make it real, and get paid per task.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>Search dreams</button>
          <button className="btn btn-primary" style={{ justifyContent: "flex-start" }}>Ask AI what fits me</button>
        </div>
      </div>

      <div className="seg" style={{ flexWrap: "wrap", margin: "var(--space-4) 0 var(--space-4)" }}>
        {cats.map((c) => (
          <button
            key={c}
            className="seg-opt"
            onClick={() => setCat(c)}
            style={
              c === cat
                ? { background: "var(--color-text)", color: "var(--color-bg)" }
                : { background: "transparent", color: "var(--color-text)" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "var(--space-3)" }}>
        {results.map((d) => (
          <div
            key={d.organizationId}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              border: "1px solid var(--color-divider)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              padding: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span
                style={{
                  flex: "none",
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: 15,
                }}
              >
                {initials(d.name)}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
                  {d.name}
                </span>
                <span style={{ fontSize: 12, color: MUTED }}>
                  {[d.holderName, d.place, d.category].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{d.statement}</p>

            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", fontSize: 12, color: MUTED }}>
              <span>{d.believers.toLocaleString()} believers</span>
              <span>{d.fundedPct}% funded</span>
              <span>{d.agents} agents</span>
            </div>

            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-2) var(--space-3)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <span style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                Needs
              </span>{" "}
              {d.needs.length > 0 ? d.needs.join(", ") : "Not stated yet"}
              {d.payBand ? (
                <>
                  {" · "}
                  <span style={{ color: "var(--accent-ink)" }}>{d.payBand}</span>
                </>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button
                className={d.joined ? "btn btn-secondary" : "btn btn-primary"}
                style={{ justifyContent: "flex-start" }}
                disabled={pending === d.organizationId}
                onClick={() => void toggleJoin(d)}
              >
                {d.joined ? "Open — joined" : "Join this dream"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p style={{ margin: "var(--space-3) 0 0", fontSize: 14, color: "var(--color-accent)" }}>{error}</p>
      ) : dreams === null ? (
        <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Loading dreams…</p>
      ) : results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
          {dreams.length === 0
            ? "No dream is published yet. A dream appears here as soon as an organization writes one."
            : "No dream matches that yet."}
        </p>
      ) : null}
    </div>
  );
}
