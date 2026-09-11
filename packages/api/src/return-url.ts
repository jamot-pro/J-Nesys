/**
 * Validates the `return` URL of an OAuth round-trip.
 *
 * Every Jamot web surface shares one API and one session cookie, so a console
 * at <org>.jamot.pro must be able to send the user through Google and get them
 * back to the page they started on — not to FRONTEND_URL, which is the cockpit.
 *
 * An unvalidated return parameter is an open redirect: an attacker sends
 * .../auth/google?return=https://evil.example and the victim lands there
 * already signed in. So the target must be on the same site as FRONTEND_URL:
 * the exact host, or a subdomain of its registrable root.
 *
 * `jamot.pro.evil.com` must NOT match, which is why the suffix test includes
 * the leading dot rather than using endsWith(root) alone.
 */
export function safeReturnUrl(raw: string | undefined, frontendUrl: string): string | null {
  if (!raw) return null;

  let target: URL;
  let frontend: URL;
  try {
    target = new URL(raw);
    frontend = new URL(frontendUrl);
  } catch {
    return null;
  }

  // Credentials in the URL are never legitimate here and can disguise the host.
  if (target.username || target.password) return null;

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (target.protocol !== "https:" && !(target.protocol === "http:" && isLocal)) return null;

  const host = target.hostname.toLowerCase();
  const frontHost = frontend.hostname.toLowerCase();
  if (host === frontHost) return target.href;

  // Same registrable root (last two labels) — covers every <org>.jamot.pro.
  const parts = frontHost.split(".");
  const root = parts.length > 2 ? parts.slice(-2).join(".") : frontHost;
  if (host === root || host.endsWith(`.${root}`)) return target.href;

  // Local development: any localhost port may return to itself.
  if (isLocal && ["localhost", "127.0.0.1", "[::1]"].includes(frontHost)) return target.href;

  return null;
}
