"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-divider)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  padding: "0 10px",
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
};

/**
 * Self-service Human Design / Gene Keys onboarding — no login, just the
 * token in the URL. Submits to the public POST endpoint
 * (packages/api/src/routes/people.ts) and refreshes the server component
 * once the report is computed and cached, so it shows the same page's
 * report view rather than duplicating its rendering here.
 */
export function OnboardForm({ token }: { token: string }) {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState("");
  const [birthHour, setBirthHour] = useState("12:00");
  const [timezone, setTimezone] = useState("0");
  const [birthLocation, setBirthLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!birthDate || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const [h, m] = birthHour.split(":").map(Number);
      const hourDecimal = (h ?? 12) + (m ?? 0) / 60;
      const res = await fetch(
        `${API_URL}/api/people/public/${encodeURIComponent(token)}/onboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            birthDate,
            birthHour: hourDecimal,
            timezone: Number(timezone) || 0,
            birthLocation: birthLocation || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not calculate your profile");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Get your Human Design &amp; Gene Keys profile
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.6,
            color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
          }}
        >
          Enter your birth date, time, and place. This calculates your own report — nothing is
          sent anywhere, and only you (via this link) can see it.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div>
          <label style={labelStyle}>Birth date</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Birth time (if known)</label>
          <input
            type="time"
            value={birthHour}
            onChange={(e) => setBirthHour(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Timezone (UTC offset)</label>
          <input
            type="number"
            step="0.5"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. -5"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Birth location</label>
          <input
            type="text"
            value={birthLocation}
            onChange={(e) => setBirthLocation(e.target.value)}
            placeholder="City, Country"
            style={inputStyle}
          />
        </div>
      </div>

      {error ? <p style={{ margin: 0, fontSize: 13, color: "oklch(0.5 0.16 30)" }}>{error}</p> : null}

      <button
        type="button"
        disabled={!birthDate || submitting}
        onClick={() => void submit()}
        style={{
          alignSelf: "flex-start",
          height: 38,
          padding: "0 18px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "var(--color-accent)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: !birthDate || submitting ? "default" : "pointer",
          opacity: !birthDate || submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Calculating…" : "Get my profile"}
      </button>
    </div>
  );
}
