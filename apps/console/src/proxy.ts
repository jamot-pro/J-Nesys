import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Resolves which organization a request belongs to, from its Host header.
 *
 * Next.js 16 renamed Middleware to Proxy; this is that file (see
 * node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 *
 * The slug is put on a request header so server components can read it with
 * `headers()` without re-parsing Host, and so the resolution rule lives in one
 * place. This is routing only — it grants nothing. Every authorization
 * decision is still made by the API against the session (`actorRoleInSpace`),
 * because a Host header is attacker-controlled and must never be trusted as
 * proof of tenancy.
 */
export const ORG_SLUG_HEADER = "x-jamot-org-slug";

const RESERVED = new Set(["www", "api", "app", "admin", "mail", "static"]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Subdomain aliases: a request to the key resolves as if it were addressed
 * to the value's org. `mvp` is the legacy marketing/demo domain (formerly its
 * own separate app); until there is a distinct "mvp" org, it should render
 * identically to `sales` rather than as an org-less console.
 */
const SLUG_ALIASES: Record<string, string> = {
  mvp: "sales",
};

export function orgSlugFromHost(host: string | null, rootDomain: string | undefined): string | null {
  if (!host || !rootDomain) return null;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const suffix = `.${rootDomain.toLowerCase()}`;
  if (!hostname.endsWith(suffix)) return null;
  const sub = hostname.slice(0, -suffix.length);
  // Only a single label is an org (acme.jamot.pro, not a.b.jamot.pro).
  if (!sub || sub.includes(".")) return null;
  if (RESERVED.has(sub) || !SLUG_RE.test(sub)) return null;
  return SLUG_ALIASES[sub] ?? sub;
}

export function proxy(request: NextRequest) {
  const slug = orgSlugFromHost(
    request.headers.get("host"),
    process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  );

  const headers = new Headers(request.headers);
  // Strip any client-supplied value before setting our own: without this a
  // caller could spoof the header directly and pick their own tenant.
  headers.delete(ORG_SLUG_HEADER);
  if (slug) headers.set(ORG_SLUG_HEADER, slug);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
