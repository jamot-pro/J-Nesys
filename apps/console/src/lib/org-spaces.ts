import { API_URL } from "@/components/auth/auth-context";

export interface OrgSpaceRef {
  spaceId: string;
  name: string;
}

/**
 * Lists the caller's organizations and returns their space ids/names.
 * Self-contained (does not depend on the org-management WIP modules).
 */
export async function listOrgSpaces(): Promise<OrgSpaceRef[]> {
  const res = await fetch(`${API_URL}/api/organizations`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `failed to load organizations (${res.status})`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      space?: { id: string; name: string };
      workspaces?: Array<{ spaceId: string; name: string }>;
    }>;
  };
  const refs: OrgSpaceRef[] = [];
  for (const item of data.items ?? []) {
    const workspaces = item.workspaces ?? [];
    if (workspaces.length > 0) {
      for (const w of workspaces) {
        if (w.spaceId) refs.push({ spaceId: w.spaceId, name: w.name });
      }
    } else if (item.space?.id) {
      refs.push({ spaceId: item.space.id, name: item.space.name ?? "" });
    }
  }
  return refs;
}
