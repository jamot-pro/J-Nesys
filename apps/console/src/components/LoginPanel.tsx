"use client";

import { useState } from "react";
import { signIn } from "@jamot/client/auth";

import "@/lib/api-config";

/** Branded sign-in. Markup uses the design system's own .card/.field/.input/
 * .btn classes rather than parallel ones (readme.md: "Build with the classes
 * below rather than inventing parallel ones"). */
export function LoginPanel({
  displayName,
  onSignedIn,
}: {
  displayName: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) onSignedIn();
    else setError(result.error ?? "Sign in failed.");
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <form className="card" onSubmit={submit}>
        <div className="card-kicker">{displayName}</div>
        <div className="card-title">Sign in</div>

        <div className="field" style={{ marginTop: "var(--space-4)" }}>
          <label htmlFor="email">Email</label>
          <input
            className="input"
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? (
          <p
            role="alert"
            style={{ color: "var(--accent-ink)", marginTop: "var(--space-3)", fontSize: 13 }}
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
          style={{ marginTop: "var(--space-4)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
