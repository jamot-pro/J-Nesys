import { API_URL } from "@/components/auth/auth-context";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(body.message ?? body.error ?? `request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export interface ApiPersonSummary {
  id: string;
  actorId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  channels: string[];
  relationship: string | null;
  lastInteractionAt: string | null;
  createdAt?: string;
}

export interface ApiIdentity {
  id: string;
  actorId: string;
  personId: string | null;
  provider: string;
  value: string;
  verified: boolean;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPersonDetail {
  id: string;
  actorId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  avatarSource: string | null;
  consent: {
    exportEnabled: boolean;
    visibility: "private" | "org" | "public";
    allowInference: boolean;
  } | null;
  lastInteractionAt: string | null;
  profile: {
    selfDescribed: Record<string, unknown>;
    integral: Record<string, unknown>;
    skills: string[];
    preferences: Record<string, unknown>;
    goals: string[];
  };
  membershipSpaceIds: string[];
  reputation: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
  actor: { id: string; displayName: string; status: string } | null;
  identities: ApiIdentity[];
  interactions: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    occurredAt: string;
  }[];
}

export interface ApiMergeCandidate {
  id: string;
  spaceId: string | null;
  personAId: string;
  personBId: string;
  reason: string;
  detail: Record<string, unknown>;
  status: "pending" | "merged" | "dismissed";
  createdAt: string;
  personA: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null;
  personB: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null;
}

export interface PeopleSearchQuery {
  spaceId: string;
  q?: string;
  channel?: string;
  sort?: "recently_active" | "recently_added" | "name";
  page?: number;
  perPage?: number;
}

export async function searchPeople(
  query: PeopleSearchQuery,
): Promise<{ items: ApiPersonSummary[]; total: number; page: number; perPage: number }> {
  const params = new URLSearchParams({ spaceId: query.spaceId });
  if (query.q) params.set("q", query.q);
  if (query.channel) params.set("channel", query.channel);
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.perPage) params.set("perPage", String(query.perPage));
  return api(`/api/people?${params.toString()}`);
}

export async function getPersonDetail(personId: string): Promise<ApiPersonDetail> {
  return api(`/api/people/${enc(personId)}`);
}

export interface PersonFieldPatch {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  consent?: { exportEnabled?: boolean; visibility?: "private" | "org" | "public"; allowInference?: boolean };
  profile?: {
    selfDescribed?: Record<string, { value: unknown; source?: string; confidence?: number }>;
    integral?: Record<string, { value: unknown; source?: string; confidence?: number }>;
    skills?: string[];
    goals?: string[];
  };
}

export async function updatePerson(
  personId: string,
  patch: PersonFieldPatch,
): Promise<ApiPersonDetail> {
  return api(`/api/people/${enc(personId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createContact(
  spaceId: string,
  input: { firstName?: string; lastName?: string; email?: string | null; phone?: string | null },
): Promise<{ person: ApiPersonDetail; actor: unknown }> {
  return api(`/api/people/contacts`, {
    method: "POST",
    body: JSON.stringify({ spaceId, ...input }),
  });
}

export async function attachIdentity(
  personId: string,
  input: { provider: string; value: string; verified?: boolean },
): Promise<ApiIdentity> {
  return api(`/api/people/${enc(personId)}/identities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeIdentity(personId: string, identityId: string): Promise<void> {
  return api(`/api/people/${enc(personId)}/identities/${enc(identityId)}`, {
    method: "DELETE",
  });
}

export async function listMergeCandidates(spaceId: string): Promise<ApiMergeCandidate[]> {
  const data = await api<{ items: ApiMergeCandidate[] }>(
    `/api/people/merge-candidates?spaceId=${enc(spaceId)}&status=pending`,
  );
  return data.items;
}

export async function resolveMergeCandidate(id: string): Promise<unknown> {
  return api(`/api/people/merge-candidates/${enc(id)}/resolve`, { method: "POST" });
}

export async function dismissMergeCandidate(id: string): Promise<unknown> {
  return api(`/api/people/merge-candidates/${enc(id)}/dismiss`, { method: "POST" });
}
