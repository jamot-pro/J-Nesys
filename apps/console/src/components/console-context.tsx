"use client";

import { createContext, useContext } from "react";
import type { MeResponse, SubdomainResolution } from "@jamot/client";
import type { OrgPublicBranding } from "@jamot/client/branding";

export interface ConsoleContextValue {
  me: MeResponse;
  resolution: SubdomainResolution;
  branding: OrgPublicBranding;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export const ConsoleProvider = ConsoleContext.Provider;

/**
 * Org context for a signed-in console section.
 *
 * Throws rather than returning null: every section below ConsoleGate renders
 * only after the session and org have resolved, so a null here would be a
 * wiring bug, and silently rendering an org-less section would be worse than
 * failing loudly.
 */
export function useConsole(): ConsoleContextValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error("useConsole must be used inside ConsoleGate");
  return value;
}

/** Ids every org-scoped API call needs. Lead lists are org-scoped; outreach
 * is space-scoped — both come from the same resolution. */
export function useOrgScope(): { organizationId: string; spaceId: string } {
  const { resolution } = useConsole();
  return {
    organizationId: resolution.organization.id,
    spaceId: resolution.space.id,
  };
}
