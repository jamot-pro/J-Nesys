"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";
import { API_URL, useAuth } from "./auth-context";
import { resolveLogoUrl } from "@/components/settings/use-org-branding";

type Mode = "login" | "register";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

interface SubdomainBrand {
  name: string;
  logoUrl: string | null;
}

async function fetchSubdomainBrand(): Promise<SubdomainBrand | null> {
  if (!ROOT_DOMAIN || typeof window === "undefined") return null;
  const host = window.location.hostname;
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, -suffix.length);
  if (!sub || ["www", "app", "api", "mvp", "mail"].includes(sub)) return null;
  try {
    const res = await fetch(
      `${API_URL}/api/organizations/resolve?subdomain=${encodeURIComponent(sub)}`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      organization: { logoUrl: string | null };
      space: { name: string };
    };
    return { name: data.space.name, logoUrl: data.organization.logoUrl ?? null };
  } catch {
    return null;
  }
}

export function LoginScreen() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brand, setBrand] = useState<SubdomainBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSubdomainBrand().then((b) => {
      if (!cancelled) setBrand(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const brandLogo = brand ? resolveLogoUrl(brand.logoUrl) : null;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const url =
        mode === "login"
          ? `${API_URL}/api/auth/login`
          : `${API_URL}/api/people`;
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, displayName: displayName || undefined };
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `${mode} failed`);
        return;
      }
      await refresh();
    } catch {
      setError("Could not reach the Jamot API");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          {brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogo} alt={brand?.name ?? "Organization"} className="size-8 object-contain" />
          ) : (
            <BrandLogo className="size-8" />
          )}
          <span className="font-display text-lg font-semibold">
            {brand?.name || "Jamot"}
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to your personal space.
        </p>

        <a
          href={`${API_URL}/api/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "register" ? (
            <Input
              placeholder="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          ) : null}
          <Input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            setError(null);
            setMode((m) => (m === "login" ? "register" : "login"));
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
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
