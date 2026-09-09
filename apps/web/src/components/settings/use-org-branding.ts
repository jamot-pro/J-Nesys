"use client";

import { API_URL } from "@/components/auth/auth-context";
import { useOptionalAppShell } from "@/components/app-shell/app-shell-context";

export interface OrgBranding {
  name: string;
  logoUrl: string | null;
  /** Fully-resolved logo URL (relative /uploads paths prefixed with API_URL). */
  resolvedLogoUrl: string | null;
}

export function resolveLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("/uploads/")) return `${API_URL}${logoUrl}`;
  return logoUrl;
}

/** Branding (logo + name) for the currently active organization space, if any.
 * Returns no branding when rendered outside the app shell (e.g. the login screen). */
export function useActiveOrgBranding(): OrgBranding {
  const shell = useOptionalAppShell();
  if (!shell) {
    return { name: "", logoUrl: null, resolvedLogoUrl: null };
  }
  const { space, organizations } = shell;
  if (space.kind !== "organization" || !space.organizationId) {
    return { name: "", logoUrl: null, resolvedLogoUrl: null };
  }
  const item = organizations.find((o) => o.organization.id === space.organizationId);
  const org = item?.organization;
  const logoUrl = org?.logoUrl ?? null;
  return {
    name: org ? item?.space.name ?? org.dream : space.name,
    logoUrl,
    resolvedLogoUrl: resolveLogoUrl(logoUrl),
  };
}
