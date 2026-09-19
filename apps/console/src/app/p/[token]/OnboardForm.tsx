"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Self-service "complete your profile" onboarding — no login, just the
 * token in the URL. Collects name/company/photo alongside the Human Design
 * birth data in one submit to the public POST endpoint
 * (packages/api/src/routes/people.ts), which marks the person `onboarded`.
 * Refreshes the server component afterward so it shows the same page's
 * report view rather than duplicating its rendering here.
 */
export function OnboardForm({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [birthHour, setBirthHour] = useState("12:00");
  const [timezone, setTimezone] = useState("0");
  const [birthLocation, setBirthLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be under 2 MB");
      return;
    }
    setError(null);
    const dataUri = await readAsDataUrl(file);
    setPhotoDataUri(dataUri);
    setPhotoPreview(dataUri);
  };

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
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            company: company || undefined,
            avatarDataUri: photoDataUri ?? undefined,
            birthDate,
            birthHour: hourDecimal,
            timezone: Number(timezone) || 0,
            birthLocation: birthLocation || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not complete your profile");
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
        gap: "var(--space-5)",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Complete your profile</h2>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.6,
            color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
          }}
        >
          A few details, a photo, and your birth date/time/place — that last part calculates your
          own Human Design &amp; Gene Keys report. Nothing here is sent anywhere else, and only
          you (via this link) can see it.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "999px",
            overflow: "hidden",
            flex: "none",
            border: "1px solid var(--color-divider)",
            background: "var(--color-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              No photo
            </span>
          )}
        </div>
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-accent)",
            cursor: "pointer",
          }}
        >
          {photoPreview ? "Change photo" : "Add a photo"}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Last name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <h3 style={{ margin: "0 0 var(--space-3)", fontSize: 13, fontWeight: 700 }}>
          Human Design &amp; Gene Keys
        </h3>
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
        {submitting ? "Saving…" : "Complete my profile"}
      </button>
    </div>
  );
}
