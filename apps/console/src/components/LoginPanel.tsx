"use client";

import { useEffect, useState } from "react";
import { signIn, signUp } from "@jamot/client/auth";
import { apiBaseUrl } from "@jamot/client/config";

import "@/lib/api-config";

type Mode = "login" | "register";

const MUTED = "color-mix(in srgb, var(--color-text) 72%, transparent)";

/** Google's own mark — its colours are fixed, so they are not tokens. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0a12 12 0 0 0-10.72 6.6l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * Branded sign-in.
 *
 * Google leads and the password form follows an "or" rule, because the grant
 * is the path most people take; the fields carry placeholders rather than
 * labels, which is what keeps the card this short.
 *
 * Registering is two calls on the API — create the person, then sign in — and
 * `signUp` does both, so a new account lands in the console rather than back
 * at this screen.
 */
export function LoginPanel({
  displayName,
  logoUrl,
  onSignedIn,
}: {
  displayName: string;
  logoUrl?: string | null;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    const result =
      mode === "login" ? await signIn(email, password) : await signUp(email, password, name);
    setBusy(false);
    if (result.ok) onSignedIn();
    else setError(result.error ?? "Sign in failed.");
  }

  const field: React.CSSProperties = {
    width: "100%",
    height: 46,
    padding: "0 var(--space-4)",
    background: "transparent",
    border: "1px solid var(--color-divider)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    font: "inherit",
    fontSize: 15,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "var(--space-6)",
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-6)" }}>
          {/* eslint-disable @next/next/no-img-element */}
          {logoUrl ? (
            <img src={logoUrl} alt="" width={30} height={30} style={{ borderRadius: 6 }} />
          ) : (
            <>
              <img className="mark-light" src="/brand/jamot-logo.webp" alt="" width={30} height={30} />
              <img className="mark-dark" src="/brand/jamot-logo-white.webp" alt="" width={30} height={30} />
            </>
          )}
          {/* eslint-enable @next/next/no-img-element */}
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>
            {displayName}
          </span>
        </div>

        <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={{ margin: "6px 0 var(--space-6)", fontSize: 14, color: MUTED }}>
          {mode === "login"
            ? "Sign in to your personal space."
            : "One account, every organization you belong to."}
        </p>

        {/* A full navigation, not fetch: the OAuth round-trip leaves the origin
            and comes back. `return` carries this console's URL so the API sends
            the user here rather than to the cockpit (FRONTEND_URL); the API
            validates it against its own site before honouring it. */}
        <a
          href={returnUrl ? `${apiBaseUrl()}/api/auth/google?return=${encodeURIComponent(returnUrl)}` : undefined}
          aria-disabled={returnUrl ? undefined : true}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            height: 46,
            width: "100%",
            border: "1px solid var(--color-divider)",
            borderRadius: 999,
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            opacity: returnUrl ? 1 : 0.5,
            pointerEvents: returnUrl ? undefined : "none",
          }}
        >
          <GoogleMark />
          Continue with Google
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", margin: "var(--space-4) 0" }}>
          <span style={{ height: 1, flex: 1, background: "var(--color-divider)" }} />
          <span style={{ fontSize: 12, color: MUTED }}>or</span>
          <span style={{ height: 1, flex: 1, background: "var(--color-divider)" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {mode === "register" ? (
            <input
              style={field}
              placeholder="Display name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <input
            style={field}
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={field}
            type="password"
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent)" }}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              height: 46,
              width: "100%",
              border: "none",
              borderRadius: 999,
              background: "var(--color-text)",
              color: "var(--color-bg)",
              font: "inherit",
              fontSize: 15,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode((m) => (m === "login" ? "register" : "login"));
          }}
          style={{
            marginTop: "var(--space-4)",
            width: "100%",
            background: "none",
            border: "none",
            color: MUTED,
            font: "inherit",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
