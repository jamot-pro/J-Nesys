import { headers } from "next/headers";
import { fetchOrgBranding, type OrgPublicBranding } from "@jamot/client/branding";

import "@/lib/api-config";
import { ORG_SLUG_HEADER } from "@/proxy";

export async function currentOrgSlug(): Promise<string | null> {
  return (await headers()).get(ORG_SLUG_HEADER);
}

/** Public branding for the org this request is addressed to, or null. */
export async function loadOrgBranding(): Promise<OrgPublicBranding | null> {
  const slug = await currentOrgSlug();
  if (!slug) return null;
  return fetchOrgBranding(slug, { next: { revalidate: 60 } } as RequestInit);
}
