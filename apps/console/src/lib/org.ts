import { headers } from "next/headers";
import { configureApiClient } from "@jamot/client/config";
import { fetchOrgBranding, type OrgPublicBranding } from "@jamot/client/branding";

import { ORG_SLUG_HEADER } from "@/proxy";

configureApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

/** Fallback when no org resolves, or the org has set no brand. Mirrors the
 * cockpit's default so the two surfaces read as one product. */
export const DEFAULT_BRAND = {
  accent: "#e11d48",
  accentForeground: "#ffffff",
} as const;

export async function currentOrgSlug(): Promise<string | null> {
  return (await headers()).get(ORG_SLUG_HEADER);
}

/** Public branding for the org this request is addressed to, or null. */
export async function loadOrgBranding(): Promise<OrgPublicBranding | null> {
  const slug = await currentOrgSlug();
  if (!slug) return null;
  return fetchOrgBranding(slug, { next: { revalidate: 60 } } as RequestInit);
}
