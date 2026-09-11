/**
 * Base URL of the Jamot API this client talks to.
 *
 * Every Jamot web surface (the internal cockpit, each per-org console) speaks to
 * the same API over HTTP and differs only in this value, so it is injected
 * rather than imported from any one app's auth context.
 *
 * Apps call `configureApiClient()` once at boot. The NEXT_PUBLIC_API_URL
 * fallback exists so a bundler that inlines the value still works without an
 * explicit call; the throw is deliberate — a silently-wrong default (e.g.
 * localhost in production) is worse than a startup failure.
 */
let configured: string | null = null;

export function configureApiClient(url: string): void {
  configured = url.replace(/\/+$/, "");
}

export function apiBaseUrl(): string {
  if (configured !== null) return configured;
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  throw new Error(
    "@jamot/client is not configured: call configureApiClient(url) at app boot, or set NEXT_PUBLIC_API_URL.",
  );
}
