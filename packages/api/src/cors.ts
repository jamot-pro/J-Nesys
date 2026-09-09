/**
 * Builds the `@fastify/cors` `origin` option from CORS_ORIGIN.
 *
 * Each configured origin also allows every subdomain of its root domain —
 * Jamot routes each organization to its own <org>.jamot.pro subdomain (see
 * COOKIE_DOMAIN=.jamot.pro sharing the session cookie across them), all
 * served by this same API, so a single configured origin like
 * https://mvp.jamot.pro must also cover https://acme.jamot.pro.
 *
 * An empty/unset CORS_ORIGIN returns `true` (permissive) — that's local dev,
 * where the web app can run on any port.
 */
export function buildCorsOrigin(rawOrigins: string | undefined): true | Array<string | RegExp> {
  const configured = (rawOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured.length === 0) return true;

  const patterns: Array<string | RegExp> = [];
  for (const value of configured) {
    patterns.push(value);
    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      continue;
    }
    const parts = hostname.split(".");
    const root = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`^https://([a-z0-9-]+\\.)*${escaped}$`));
  }
  return patterns;
}
