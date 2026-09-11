import { apiBaseUrl } from "./config";

/**
 * Browser-side mirror of `OrgBranding` / `OrgPublicBranding` in
 * @jamot/contracts.
 *
 * It is mirrored rather than imported because contracts is a Node package
 * (NodeNext, `.js` specifiers) that a browser bundler cannot resolve — the
 * same reason apps/web hand-declares its types in this package rather than
 * importing them. Contracts remains the source of truth; this must be kept in
 * step with `OrgPublicBranding` there.
 */
export interface OrgBranding {
  accent?: string;
  accentForeground?: string;
  wordmarkUrl?: string | null;
  displayName?: string;
}

export interface OrgPublicBranding {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  branding: OrgBranding;
}

/**
 * Fetch an organization's public branding. Unauthenticated — this renders the
 * first paint of a per-org console, before any session exists.
 *
 * Returns null instead of throwing for any failure (unknown org, API down,
 * malformed payload): branding is decoration, and must never be the thing that
 * takes a console offline.
 */
export async function fetchOrgBranding(
  slug: string,
  init?: RequestInit,
): Promise<OrgPublicBranding | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/organizations/${encodeURIComponent(slug)}/branding`,
      init,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<OrgPublicBranding>;
    if (typeof data?.slug !== "string" || typeof data?.displayName !== "string") {
      return null;
    }
    return {
      slug: data.slug,
      displayName: data.displayName,
      logoUrl: data.logoUrl ?? null,
      branding: data.branding ?? {},
    };
  } catch {
    return null;
  }
}
