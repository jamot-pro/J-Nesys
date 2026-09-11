"use client";

import { useEffect, useState } from "react";
import { signIn } from "@jamot/client/auth";
import { apiBaseUrl } from "@jamot/client/config";

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
  const [returnUrl, setReturnUrl] = useState("");

  // window is unavailable while this renders on the server, so read the current
  // URL after mount. Until then the Google link has no target and is disabled.
  useEffect(() => {
    setReturnUrl(window.location.href);
  }, []);

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

        {/* A full navigation, not fetch: the OAuth round-trip leaves the origin
            and comes back. `return` carries this console's URL so the API sends
            the user here rather than to the cockpit (FRONTEND_URL); the API
            validates it against its own site before honouring it. */}
        <a
          className="btn btn-secondary btn-block"
          style={{ marginTop: "var(--space-2)" }}
          href={`${apiBaseUrl()}/api/auth/google?return=${encodeURIComponent(returnUrl)}`}
        >
          Continue with Google
        </a>

        <p className="card-meta" style={{ marginTop: "var(--space-3)" }}>
          Signing in here signs you in across every Jamot organization you belong to.
        </p>
      </form>
    </div>
  );
}
