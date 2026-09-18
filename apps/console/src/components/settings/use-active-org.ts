"use client";

import { useAppShell } from "@/components/app-shell/app-shell-context";

export function useActiveOrg() {
  const { space } = useAppShell();
  const isOrg = space.kind === "organization" && Boolean(space.organizationId);
  const organizationId = isOrg ? (space.organizationId as string) : null;
  const role = space.role ?? null;
  const isAdmin = role === "owner" || role === "admin";
  return { space, isOrg, organizationId, role, isAdmin };
}