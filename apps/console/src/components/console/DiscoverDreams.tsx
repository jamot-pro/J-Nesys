"use client";

import { useState } from "react";

/** Fixture copied verbatim from the mockup's PUBLIC_DREAMS. There is no
 * dreams endpoint yet, so the mockup's own content stands until one exists. */
interface Dream {
  id: string;
  name: string;
  holder: string;
  place: string;
  cat: string;
  believers: string;
  pct: number;
  agents: string;
  statement: string;
  need: string;
  pay: string;
  joined?: boolean;
}

const PUBLIC_DREAMS: Dream[] = [
  { id: "tidal", name: "Tidal Grid", holder: "Mara Jansen", place: "Utrecht", cat: "Energy", believers: "1,232", pct: 62, agents: "14", statement: "Put tidal power on the grid of every small island in the North Sea, owned by the people who live there.", need: "Grid analysts, translators, permit readers", pay: "€40–€120 / task", joined: true },
  { id: "seedbank", name: "Open Seed Bank", holder: "Ifeoma Adeyemi", place: "Lagos", cat: "Food", believers: "4,870", pct: 41, agents: "31", statement: "A public, free seed library for every climate zone in West Africa, with agents that match seeds to soil.", need: "Agronomists, data entry, field photographers", pay: "€25–€90 / task" },
  { id: "lumen", name: "Lumen Schools", holder: "Diego Ferraz", place: "Porto", cat: "Education", believers: "2,104", pct: 78, agents: "22", statement: "Every rural school in Portugal gets a tutor agent that speaks the local dialect and never gives up on a student.", need: "Teachers, dialect speakers, curriculum reviewers", pay: "€30–€150 / task", joined: true },
  { id: "reknit", name: "Reknit", holder: "Hanna Vogel", place: "Leipzig", cat: "Circular", believers: "918", pct: 24, agents: "9", statement: "Make repairing a garment cheaper than replacing it, in every European city, by 2030.", need: "Tailors, logistics planners, pricing analysts", pay: "€20–€75 / task" },
  { id: "quietsky", name: "Quiet Sky", holder: "Ravi Menon", place: "Bengaluru", cat: "Cities", believers: "3,406", pct: 55, agents: "18", statement: "Measure night noise on every street of one city, then hand the map to the people who can change it.", need: "Field interviewers, supply-chain", pay: "€35–€110 / task" },
  { id: "ledger", name: "Fair Ledger", holder: "Amara Osei", place: "Accra", cat: "Commerce", believers: "1,677", pct: 33, agents: "12", statement: "Every cocoa farmer sees the final shelf price of their own beans, and can act on it.", need: "Field interviewers, supply-chain", pay: "€30–€95 / task" },
];

const CATS = ["All", "Energy", "Food", "Education", "Circular", "Cities", "Commerce"];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const MUTED = "color-mix(in srgb, var(--color-text) 74%, transparent)";

/** Discover Dreams — a direct port of OrgConsole.dc.html's `discover-dreams`
 * region (lines 171–228), styles verbatim. */
export function DiscoverDreams() {
  const [cat, setCat] = useState("All");
  const results = cat === "All" ? PUBLIC_DREAMS : PUBLIC_DREAMS.filter((d) => d.cat === cat);

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
        {CATS.map((c) => (
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
            key={d.id}
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
                  {d.holder} · {d.place} · {d.cat}
                </span>
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{d.statement}</p>

            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", fontSize: 12, color: MUTED }}>
              <span>{d.believers} believers</span>
              <span>{d.pct}% funded</span>
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
              {d.need} · <span style={{ color: "var(--accent-ink)" }}>{d.pay}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              {d.joined ? (
                <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>Open — joined</button>
              ) : (
                <button className="btn btn-primary" style={{ justifyContent: "flex-start" }}>Join this dream</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No dream matches that yet.</p>
      ) : null}
    </div>
  );
}
