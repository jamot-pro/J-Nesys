import { API_URL } from "@/components/auth/auth-context";

export type OrgRole = "owner" | "admin" | "member" | "agent" | "external" | null;

export type MemberRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  createdAt: string;
  updatedAt: string;
  spaceId: string;
  slug: string | null;
  logoUrl: string | null;
  dream: string;
  blueprint: Record<string, unknown>;
  enabledAppIds: string[];
  treasuryId: string | null;
  reputation: Record<string, number>;
}

export interface Space {
  id: string;
  kind: "personal" | "organization";
  ownerActorId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  organizationId: string;
  spaceId: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SubdomainResolution {
  organization: Organization;
  space: Space;
  workspaces: Workspace[];
  role: OrgRole;
}

export interface OrganizationListItem {
  organization: Organization;
  space: Space;
  role: OrgRole;
  workspaces: Workspace[];
}

export interface OrganizationMember {
  personId: string;
  actorId: string;
  email: string | null;
  displayName: string;
  kind: MemberRole;
  title: string | null;
  membershipSince: string;
}

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entities: string[];
  capabilities: string[];
  tools: string[];
  events: string[];
  hooks: string[];
  settings: Record<string, unknown>;
  canvas: string[];
  permissions: string[];
}

export interface AppAllocation {
  organizationId: string;
  enabledAppIds: string[];
  apps: Array<AppManifest & { enabled: boolean }>;
}

export interface MePerson {
  id: string;
  actorId?: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  consent?: {
    exportEnabled: boolean;
    visibility: "private" | "org" | "public";
    allowInference: boolean;
  } | null;
  membershipSpaceIds: string[];
}

export interface MeResponse {
  actor: { id: string; type: string; displayName: string };
  person: MePerson | null;
  isSuperAdmin: boolean;
}

export type AgentAutonomy = "suggest" | "approve" | "autonomous";
export type AgentActionPermission = "automatic" | "approval" | "never";

export interface ApiAgentSchedule {
  id: string;
  enabled: boolean;
  cron: string;
  prompt: string;
}

export interface ApiAgentHeartbeat {
  enabled: boolean;
  cron: string | null;
  quietHours: string | null;
  check: string[];
  onAction: "act" | "ask" | "notify";
}

export interface ApiAgent {
  id: string;
  actorId: string;
  ownerId: string;
  organizationIds: string[];
  role: string | null;
  purpose: string | null;
  description: string | null;
  harness: {
    kind: string;
    endpoint: string | null;
    config: Record<string, unknown>;
  };
  skillIds: string[];
  capabilityIds: string[];
  connectorIds: string[];
  permissions: string[];
  autonomy: AgentAutonomy;
  budget: number | null;
  heartbeat: ApiAgentHeartbeat;
  memoryScopes: string[];
  subscribedEvents: string[];
  schedules: ApiAgentSchedule[];
  actionPermissions: Record<string, AgentActionPermission>;
  availability: "available" | "busy" | "offline";
  systemPrompt: string | null;
  model: string | null;
  performance: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAgentRelationship {
  id: string;
  fromActorId: string;
  toActorId: string;
  kind: string;
  from: { id: string; displayName: string; type: "human" | "agent" } | null;
  to: { id: string; displayName: string; type: "human" | "agent" } | null;
}

export interface ApiEvent {
  id: string;
  type: string;
  actorId: string | null;
  spaceId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type UpdateAgentBody = {
  role?: string | null;
  purpose?: string | null;
  description?: string | null;
  organizationIds?: string[];
  skillIds?: string[];
  capabilityIds?: string[];
  connectorIds?: string[];
  permissions?: string[];
  autonomy?: AgentAutonomy;
  budget?: number | null;
  heartbeat?: ApiAgentHeartbeat;
  memoryScopes?: string[];
  subscribedEvents?: string[];
  schedules?: ApiAgentSchedule[];
  actionPermissions?: Record<string, AgentActionPermission>;
  availability?: "available" | "busy" | "offline";
  systemPrompt?: string | null;
  model?: string | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function getMe(): Promise<MeResponse> {
  return api<MeResponse>("/api/auth/me");
}

export async function getOrganizations(): Promise<OrganizationListItem[]> {
  const data = await api<{ items: OrganizationListItem[] }>("/api/organizations");
  return data.items;
}

export async function getOrganization(id: string): Promise<Organization> {
  return api<Organization>(`/api/organizations/${id}`);
}

export async function listWorkspaces(organizationId: string): Promise<Workspace[]> {
  const data = await api<{ items: Workspace[] }>(
    `/api/organizations/${encodeURIComponent(organizationId)}/workspaces`,
  );
  return data.items;
}

export async function createWorkspace(
  organizationId: string,
  name: string,
  config?: Record<string, unknown>,
): Promise<Workspace> {
  return api<Workspace>(
    `/api/organizations/${encodeURIComponent(organizationId)}/workspaces`,
    { method: "POST", body: JSON.stringify({ name, config }) },
  );
}

export async function updateWorkspace(
  organizationId: string,
  workspaceId: string,
  patch: { name?: string; config?: Record<string, unknown> },
): Promise<Workspace> {
  return api<Workspace>(
    `/api/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deleteWorkspace(
  organizationId: string,
  workspaceId: string,
): Promise<unknown> {
  return api(
    `/api/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" },
  );
}

export async function createOrganization(input: {
  name: string;
  dream?: string;
  slug?: string;
}): Promise<{ organization: Organization; space: Space }> {
  return api<{ organization: Organization; space: Space }>("/api/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      dream: input.dream,
      slug: input.slug,
    }),
  });
}

export async function updateOrganization(
  organizationId: string,
  patch: { name?: string; slug?: string | null; logoUrl?: string | null; dream?: string },
): Promise<Organization> {
  const data = await api<{ organization: Organization }>(
    `/api/organizations/${organizationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  return data.organization;
}

export async function deleteOrganization(
  organizationId: string,
  confirmName: string,
): Promise<void> {
  await api<void>(`/api/organizations/${organizationId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmName }),
  });
}

export async function uploadOrganizationLogo(
  organizationId: string,
  dataUri: string,
): Promise<{ logoUrl: string }> {
  return api<{ logoUrl: string }>(`/api/organizations/${organizationId}/logo`, {
    method: "PUT",
    body: JSON.stringify({ dataUri }),
  });
}

export async function resolveOrganizationBySubdomain(
  subdomain: string,
): Promise<SubdomainResolution> {
  return api<SubdomainResolution>(
    `/api/organizations/resolve?subdomain=${encodeURIComponent(subdomain)}`,
  );
}

export async function updateOrganizationDream(
  organizationId: string,
  dream: string,
): Promise<Organization> {
  const data = await api<{ organization: Organization }>(
    `/api/organizations/${organizationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ dream }),
    },
  );
  return data.organization;
}

export async function getOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMember[]> {
  const data = await api<{ items: OrganizationMember[] }>(
    `/api/organizations/${organizationId}/members`,
  );
  return data.items;
}

export async function addOrganizationMember(
  organizationId: string,
  input: { email: string; role: "admin" | "member" },
): Promise<OrganizationMember> {
  return api<OrganizationMember>(`/api/organizations/${organizationId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: input.email, role: input.role }),
  });
}

export async function updateOrganizationMember(
  organizationId: string,
  personId: string,
  role: "admin" | "member",
): Promise<OrganizationMember> {
  return api<OrganizationMember>(
    `/api/organizations/${organizationId}/members/${personId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export async function removeOrganizationMember(
  organizationId: string,
  personId: string,
): Promise<void> {
  await api<void>(`/api/organizations/${organizationId}/members/${personId}`, {
    method: "DELETE",
  });
}

export async function getOrganizationApps(
  organizationId: string,
): Promise<AppAllocation> {
  return api<AppAllocation>(`/api/organizations/${organizationId}/apps`);
}

export async function setOrganizationApps(
  organizationId: string,
  enabledAppIds: string[],
): Promise<AppAllocation> {
  return api<AppAllocation>(`/api/organizations/${organizationId}/apps`, {
    method: "PUT",
    body: JSON.stringify({ enabledAppIds }),
  });
}

export async function getApps(): Promise<AppManifest[]> {
  const data = await api<{ items: AppManifest[] }>("/api/apps");
  return data.items;
}

export async function getAgents(): Promise<ApiAgent[]> {
  const data = await api<{ items: ApiAgent[] }>("/api/agents");
  return data.items;
}

export async function getAgent(id: string): Promise<ApiAgent> {
  return api<ApiAgent>(`/api/agents/${encodeURIComponent(id)}`);
}

export async function updateAgent(
  id: string,
  body: UpdateAgentBody,
): Promise<ApiAgent> {
  return api<ApiAgent>(`/api/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await api<void>(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAgentActivity(id: string): Promise<ApiEvent[]> {
  const data = await api<{ items: ApiEvent[] }>(
    `/api/agents/${encodeURIComponent(id)}/activity`,
  );
  return data.items;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  summary: string;
  read: boolean;
  createdAt?: string;
}

export async function listNotifications(
  spaceId?: string,
): Promise<ApiNotification[]> {
  const query = spaceId
    ? `?spaceId=${encodeURIComponent(spaceId)}`
    : "";
  const data = await api<{ items: ApiNotification[] }>(
    `/api/notifications${query}`,
  );
  return data.items;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api(`/api/notifications/read-all`, {
    method: "PUT",
  });
}

export async function listAgentRelationships(
  id: string,
): Promise<ApiAgentRelationship[]> {
  const data = await api<{ items: ApiAgentRelationship[] }>(
    `/api/agents/${encodeURIComponent(id)}/relationships`,
  );
  return data.items;
}

export async function addAgentRelationship(input: {
  agentId: string;
  fromActorId: string;
  toActorId: string;
  kind: string;
}): Promise<ApiAgentRelationship> {
  return api<ApiAgentRelationship>(
    `/api/agents/${encodeURIComponent(input.agentId)}/relationships`,
    {
      method: "POST",
      body: JSON.stringify({
        fromActorId: input.fromActorId,
        toActorId: input.toActorId,
        kind: input.kind,
      }),
    },
  );
}

export async function removeAgentRelationship(
  agentId: string,
  relationshipId: string,
): Promise<void> {
  await api<void>(
    `/api/agents/${encodeURIComponent(agentId)}/relationships/${encodeURIComponent(relationshipId)}`,
    { method: "DELETE" },
  );
}

export type AgentAutonomyValue = "suggest" | "approve" | "autonomous";
export type AgentAvailabilityValue = "available" | "busy" | "offline";

export async function createAgent(input: {
  name: string;
  ownerId: string;
  role?: string | null;
  organizationIds?: string[];
  autonomy?: AgentAutonomyValue;
  availability?: AgentAvailabilityValue;
  harness?: {
    kind: string;
    endpoint?: string | null;
    config?: Record<string, unknown>;
  };
}): Promise<ApiAgent> {
  return api<ApiAgent>("/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      ownerId: input.ownerId,
      role: input.role ?? null,
      organizationIds: input.organizationIds ?? [],
      autonomy: input.autonomy ?? "approve",
      availability: input.availability ?? "available",
      harness: input.harness ?? { kind: "mcp", endpoint: null },
    }),
  });
}

export async function updateOwnActor(
  actorId: string,
  patch: { displayName?: string },
): Promise<unknown> {
  return api(`/api/actors/${actorId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await api("/api/auth/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnProfile(
  personId: string,
  patch: {
    email?: string | null;
    profile?: {
      selfDescribed?: Record<string, { value: unknown; source?: string; confidence?: number }>;
      integral?: Record<string, { value: unknown; source?: string; confidence?: number }>;
      preferences?: Record<string, { value: unknown; source?: string; confidence?: number }>;
      skills?: string[];
      goals?: string[];
    };
  },
): Promise<unknown> {
  return api(`/api/people/${personId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface ApiConnector {
  id: string;
  provider: string;
  type: string;
  ownerActorId: string | null;
  ownerOrganizationId: string | null;
  capabilities: string[];
  credentialRef: { ref: string; scope: string };
  scopes: string[];
  configuration: Record<string, unknown>;
  status: string;
  sharing?: "user" | "organization";
  createdAt: string;
}

export interface ApiVault {
  connectors: ApiConnector[];
  secretRefs: Array<{ ref: string; scope: string }>;
}

export async function getVault(): Promise<ApiVault> {
  return api<ApiVault>("/api/vault");
}

export async function addVaultConnection(input: {
  provider: string;
  type?: string;
  ref: string;
  scope?: "user" | "organization" | "system" | "environment";
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  capabilities?: string[];
  scopes?: string[];
  configuration?: Record<string, unknown>;
  secretPlaintext: string;
}): Promise<ApiConnector> {
  return api<ApiConnector>("/api/vault/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteVaultConnection(ref: string): Promise<{ status: string }> {
  return api(`/api/vault/connections/${encodeURIComponent(ref)}`, { method: "DELETE" });
}

/**
 * Model configuration — provider-agnostic. A provider is any
 * OpenAI-compatible endpoint (OpenAI, OpenRouter, self-hosted gateways).
 * Flow: Provider → Base URL → API Key → Test/Discover → Models → Enable.
 */
export interface ApiProviderModel {
  id: string;
  modelId: string;
  discovered: boolean;
  enabled: boolean;
}

export interface ApiModelProvider {
  id: string;
  ownerActorId: string | null;
  ownerOrganizationId: string | null;
  name: string;
  baseUrl: string;
  status: "ok" | "error" | "unknown";
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  hasKey: boolean;
  models: ApiProviderModel[];
}

export interface ApiModelTestResult {
  ok: boolean;
  models: string[];
  error?: string;
}

export async function listModelProviders(
  organizationId?: string,
): Promise<ApiModelProvider[]> {
  const path = organizationId
    ? `/api/models/providers?organizationId=${encodeURIComponent(organizationId)}`
    : "/api/models/providers";
  const data = await api<{ items: ApiModelProvider[] }>(path);
  return data.items;
}

export async function createModelProvider(input: {
  name: string;
  baseUrl: string;
  apiKey: string;
  organizationId?: string | null;
}): Promise<{ provider: ApiModelProvider; test: ApiModelTestResult }> {
  return api("/api/models/providers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateModelProvider(
  id: string,
  patch: { name?: string; baseUrl?: string; apiKey?: string },
): Promise<{ provider: ApiModelProvider; test: ApiModelTestResult | null }> {
  return api(`/api/models/providers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function testModelProvider(
  id: string,
): Promise<{ provider: ApiModelProvider; test: ApiModelTestResult }> {
  return api(`/api/models/providers/${encodeURIComponent(id)}/test`, {
    method: "POST",
  });
}

export async function deleteModelProvider(id: string): Promise<void> {
  await api<void>(`/api/models/providers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addProviderModel(
  providerId: string,
  modelId: string,
): Promise<ApiProviderModel> {
  return api(`/api/models/providers/${encodeURIComponent(providerId)}/models`, {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });
}

export async function setProviderModelEnabled(
  providerId: string,
  modelRowId: string,
  enabled: boolean,
): Promise<ApiProviderModel> {
  return api(
    `/api/models/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelRowId)}`,
    { method: "PATCH", body: JSON.stringify({ enabled }) },
  );
}

export async function deleteProviderModel(
  providerId: string,
  modelRowId: string,
): Promise<void> {
  await api<void>(
    `/api/models/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelRowId)}`,
    { method: "DELETE" },
  );
}

export interface ApiEnabledModel {
  providerId: string;
  providerName: string;
  modelId: string;
  baseUrl: string;
}

export async function listEnabledModels(
  organizationId?: string,
): Promise<ApiEnabledModel[]> {
  const path = organizationId
    ? `/api/models/enabled?organizationId=${encodeURIComponent(organizationId)}`
    : "/api/models/enabled";
  const data = await api<{ items: ApiEnabledModel[] }>(path);
  return data.items;
}

/* -------------- Model ref helpers -------------- */

/** Encode a model reference as `providerId::modelId`. */
export function encodeModelRef(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

/** Decode a model reference returned by the backend. */
export function decodeModelRef(ref: string | null | undefined): {
  providerId: string;
  modelId: string;
} | null {
  if (!ref || !ref.includes("::")) return null;
  const idx = ref.indexOf("::");
  return { providerId: ref.slice(0, idx), modelId: ref.slice(idx + 2) };
}

/* -------------- Space settings -------------- */

export interface SpaceSettingsResponse {
  orchestratorModel: string | null;
}

export async function getSpaceSettings(
  spaceId: string,
): Promise<SpaceSettingsResponse> {
  return api(`/api/spaces/${encodeURIComponent(spaceId)}/settings`);
}

export async function updateSpaceSettings(
  spaceId: string,
  input: { orchestratorModel?: string | null },
): Promise<SpaceSettingsResponse> {
  return api(`/api/spaces/${encodeURIComponent(spaceId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}


export async function listConnectors(
  ownerOrganizationId?: string,
): Promise<ApiConnector[]> {
  const path = ownerOrganizationId
    ? `/api/connectors?ownerOrganizationId=${encodeURIComponent(ownerOrganizationId)}`
    : "/api/connectors";
  const data = await api<{ items: ApiConnector[] }>(path);
  return data.items;
}

export async function createConnector(input: {
  provider: string;
  type?: string;
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  capabilities?: string[];
  credentialRef: { ref: string; scope: string };
  scopes?: string[];
  configuration?: Record<string, unknown>;
  secretPlaintext: string;
}): Promise<ApiConnector> {
  return api<ApiConnector>("/api/connectors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ComposioToolkit {
  key: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ComposioTool {
  slug: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ComposioConnection {
  id: string;
  toolkit: string;
  sharing: "user" | "organization";
  organizationId: string | null;
  accountStatus?: string;
  status: string;
  mcpUrl?: string | null;
  mcpHeaders?: Record<string, string> | null;
}

export interface ComposioExecuteResult {
  data?: unknown;
  successful?: boolean;
  executionDetails?: unknown;
}

export async function listComposioToolkits(): Promise<ComposioToolkit[]> {
  const data = await api<{ items: ComposioToolkit[] }>("/api/composio/toolkits");
  return data.items;
}

export async function getComposioKeyConfigured(): Promise<{ configured: boolean }> {
  return api("/api/composio/key");
}

export async function setComposioKey(apiKey: string): Promise<{ configured: boolean }> {
  return api("/api/composio/key", {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });
}

export async function listComposioConnections(
  organizationId?: string,
): Promise<ComposioConnection[]> {
  const path = organizationId
    ? `/api/composio/connections?organizationId=${encodeURIComponent(organizationId)}`
    : "/api/composio/connections";
  const data = await api<{ items: ComposioConnection[] }>(path);
  return data.items;
}

export async function createComposioConnection(input: {
  toolkit: string;
  sharing: "user" | "organization";
  organizationId?: string | null;
}): Promise<{ redirectUrl: string; state: string }> {
  return api("/api/composio/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listConnectionTools(
  connectorId: string,
): Promise<ComposioTool[]> {
  const data = await api<{ items: ComposioTool[] }>(
    `/api/composio/connections/${encodeURIComponent(connectorId)}/tools`,
  );
  return data.items;
}

export async function executeComposioTool(input: {
  connectorId: string;
  tool: string;
  arguments?: Record<string, unknown>;
}): Promise<ComposioExecuteResult> {
  return api<ComposioExecuteResult>("/api/composio/execute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteComposioConnection(
  connectorId: string,
): Promise<{ status: string }> {
  return api(`/api/composio/connections/${encodeURIComponent(connectorId)}`, {
    method: "DELETE",
  });
}

export async function ensureConnectionMcp(connectorId: string): Promise<{
  url: string;
  headers: Record<string, string>;
}> {
  return api(`/api/composio/connections/${encodeURIComponent(connectorId)}/mcp`, {
    method: "POST",
  });
}

export interface ApiSkill {
  id: string;
  ownerActorId: string | null;
  ownerOrganizationId: string | null;
  name: string;
  description: string;
  body: string;
  version: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  prerequisites: string[];
  allowedCapabilityIds: string[];
  evaluationCriteria: string[];
  status: string;
  createdAt: string;
}

export async function listSkills(ownerOrganizationId?: string): Promise<ApiSkill[]> {
  const path = ownerOrganizationId
    ? `/api/skills?ownerOrganizationId=${encodeURIComponent(ownerOrganizationId)}`
    : "/api/skills";
  const data = await api<{ items: ApiSkill[] }>(path);
  return data.items;
}

export async function createSkill(input: {
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  name: string;
  description?: string;
  body?: string;
  version?: string;
  evaluationCriteria?: string[];
  status?: "draft" | "validated" | "deprecated";
  provenance?: { source?: string; confidence?: number };
}): Promise<ApiSkill> {
  return api<ApiSkill>("/api/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSkill(
  id: string,
  patch: {
    name?: string;
    description?: string;
    body?: string;
    version?: string;
    evaluationCriteria?: string[];
    status?: "draft" | "validated" | "deprecated";
  },
): Promise<ApiSkill> {
  return api<ApiSkill>(`/api/skills/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteSkill(id: string): Promise<void> {
  await api<void>(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface ApiCapability {
  id: string;
  name: string;
  skillId: string;
  connectorId: string;
  policyIds: string[];
  context: Record<string, unknown>;
  spaceId: string;
  createdAt: string;
}

export async function listCapabilities(spaceId?: string): Promise<ApiCapability[]> {
  const path = spaceId
    ? `/api/capabilities?spaceId=${encodeURIComponent(spaceId)}`
    : "/api/capabilities";
  const data = await api<{ items: ApiCapability[] }>(path);
  return data.items;
}

export async function createCapability(input: {
  name: string;
  skillId: string;
  connectorId: string;
  policyIds?: string[];
  context?: Record<string, unknown>;
  spaceId: string;
}): Promise<ApiCapability> {
  return api<ApiCapability>("/api/capabilities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ApiMemoryEntry {
  id: string;
  scope: string;
  ownerId: string;
  content: Record<string, unknown>;
  provenance: { source: string; confidence: number };
  createdAt: string;
  updatedAt: string;
}

export async function listMemory(scope: string, ownerId: string): Promise<ApiMemoryEntry[]> {
  const data = await api<{ items: ApiMemoryEntry[] }>(
    `/api/memory?scope=${encodeURIComponent(scope)}&ownerId=${encodeURIComponent(ownerId)}`,
  );
  return data.items;
}

export async function storeMemory(input: {
  scope: string;
  ownerId: string;
  content: Record<string, unknown>;
  provenance?: { source?: string; confidence?: number };
}): Promise<ApiMemoryEntry> {
  return api<ApiMemoryEntry>("/api/memory", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function forgetMemory(id: string): Promise<void> {
  await api<void>(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateMemory(
  id: string,
  patch: {
    content?: Record<string, unknown>;
    provenance?: { source?: string; confidence?: number };
  },
): Promise<ApiMemoryEntry> {
  return api<ApiMemoryEntry>(`/api/memory/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface ApiKnowledgeEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  validFrom: string;
  validTo: string | null;
  provenance: { source: string; confidence: number };
}

export async function listKnowledgeEntities(): Promise<ApiKnowledgeEntity[]> {
  const data = await api<{ items: ApiKnowledgeEntity[] }>("/api/knowledge/entities");
  return data.items;
}

export async function addKnowledgeEntity(input: {
  type: string;
  name: string;
  properties?: Record<string, unknown>;
}): Promise<ApiKnowledgeEntity> {
  return api<ApiKnowledgeEntity>("/api/knowledge/entities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listKnowledgeEdges(entityId: string): Promise<ApiKnowledgeEdge[]> {
  const data = await api<{ items: ApiKnowledgeEdge[] }>(
    `/api/knowledge/edges?entityId=${encodeURIComponent(entityId)}`,
  );
  return data.items;
}

export async function addKnowledgeEdge(input: {
  sourceId: string;
  targetId: string;
  relation: string;
  provenance?: { source?: string; confidence?: number };
}): Promise<ApiKnowledgeEdge> {
  return api<ApiKnowledgeEdge>("/api/knowledge/edges", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ApiSupplier {
  id: string;
  actorId: string;
  organizationId: string | null;
  onboardingStatus: string;
  defaultCurrency: string;
  terms: string | null;
  reputation: Record<string, number>;
  createdAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  gtin: string | null;
  sku: string | null;
  lifeCycle: string;
  unitOfMeasure: string;
  description: string;
}

export interface ApiCatalog {
  id: string;
  ownerOrganizationId: string;
  name: string;
  version: string;
  visibility: string;
  status: string;
  source: string;
  sourceOfTruth: string;
  syncRef: string | null;
}

export interface ApiCatalogOffer {
  id: string;
  catalogId: string;
  sellerOrganizationId: string;
  productId: string;
  priceQuantity: number;
  priceTiers: Array<{ minQty: number; amount: number; currency: string }>;
  minQty: number;
  maxQty: number | null;
  orderIncrement: number;
  availability: string | null;
  leadTime: string | null;
  status: string;
}

export interface ApiQuoteRequest {
  id: string;
  buyerOrganizationId: string;
  title: string;
  description: string;
  items: Array<{ productId: string; quantity: number }>;
  status: string;
  responseDeadline: string | null;
}

export interface ApiQuote {
  id: string;
  quoteRequestId: string;
  sellerOrganizationId: string;
  total: number;
  currency: string;
  status: string;
  terms: string | null;
  validUntil: string | null;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface ApiPurchaseOrder {
  id: string;
  quoteId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  total: number;
  currency: string;
  status: string;
  paymentIntentId: string | null;
  approvedByActorId: string | null;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface ApiPaymentIntent {
  id: string;
  purchaseOrderId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  currency: string;
  estimatedAmount: number;
  provider: string;
  status: string;
  requiresApproval: boolean;
  approvedByActorId: string | null;
  providerReference: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ApiPaymentRecord {
  id: string;
  paymentIntentId: string;
  paidAmount: number;
  currency: string;
  providerReference: string | null;
  settledAt: string;
}

export async function registerSupplier(input: {
  actorId: string;
  organizationId?: string | null;
  terms?: string | null;
}): Promise<ApiSupplier> {
  return api<ApiSupplier>("/api/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listSuppliers(): Promise<ApiSupplier[]> {
  const data = await api<{ items: ApiSupplier[] }>("/api/suppliers");
  return data.items;
}

export interface ApiActor {
  id: string;
  type: "human" | "agent";
  displayName: string;
}

export async function listActors(): Promise<ApiActor[]> {
  const data = await api<{ items: ApiActor[] }>("/api/actors");
  return data.items;
}

export async function createProduct(input: {
  name: string;
  gtin?: string;
  sku?: string;
  unitOfMeasure?: string;
  description?: string;
}): Promise<ApiProduct> {
  return api<ApiProduct>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listProducts(spaceId?: string): Promise<ApiProduct[]> {
  const path = spaceId
    ? `/api/products?spaceId=${encodeURIComponent(spaceId)}`
    : "/api/products";
  const data = await api<{ items: ApiProduct[] }>(path);
  return data.items;
}

export async function createCatalog(input: {
  ownerOrganizationId: string;
  name: string;
  visibility?: string;
}): Promise<ApiCatalog> {
  return api<ApiCatalog>("/api/catalogs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listCatalogs(
  ownerOrganizationId?: string,
): Promise<ApiCatalog[]> {
  const path = ownerOrganizationId
    ? `/api/catalogs?ownerOrganizationId=${encodeURIComponent(ownerOrganizationId)}`
    : "/api/catalogs";
  const data = await api<{ items: ApiCatalog[] }>(path);
  return data.items;
}

export async function publishCatalog(id: string): Promise<ApiCatalog> {
  return api<ApiCatalog>(`/api/catalogs/${id}/publish`, { method: "POST" });
}

export async function createCatalogOffer(input: {
  catalogId: string;
  sellerOrganizationId: string;
  productId: string;
  priceTiers: Array<{ minQty: number; amount: number; currency: string }>;
  minQty?: number;
}): Promise<ApiCatalogOffer> {
  return api<ApiCatalogOffer>("/api/catalog-offers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listCatalogOffers(opts?: {
  sellerOrganizationId?: string;
}): Promise<ApiCatalogOffer[]> {
  const params = new URLSearchParams();
  if (opts?.sellerOrganizationId) {
    params.set("sellerOrganizationId", opts.sellerOrganizationId);
  }
  const qs = params.toString();
  const data = await api<{ items: ApiCatalogOffer[] }>(
    `/api/catalog-offers${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export type NetworkSearchHit = ApiCatalogOffer & {
  offerId: string;
  productName: string;
  currency: string;
  unitPrice: number;
  reputation: number;
  matchScore: number;
};

export async function searchNetworkHits(input: {
  q?: string;
  minQty?: number;
}): Promise<NetworkSearchHit[]> {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.minQty) params.set("minQty", String(input.minQty));
  const qs = params.toString();
  const data = await api<{ items: NetworkSearchHit[] }>(
    `/api/network/search${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createQuoteRequest(input: {
  buyerOrganizationId: string;
  title: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<ApiQuoteRequest> {
  return api<ApiQuoteRequest>("/api/quote-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listQuoteRequests(
  buyerOrganizationId: string,
): Promise<ApiQuoteRequest[]> {
  const data = await api<{ items: ApiQuoteRequest[] }>(
    `/api/quote-requests?buyerOrganizationId=${encodeURIComponent(buyerOrganizationId)}`,
  );
  return data.items;
}

export async function acceptQuote(
  quoteRequestId: string,
  quoteId: string,
): Promise<{ request: ApiQuoteRequest; quote: ApiQuote }> {
  return api<{ request: ApiQuoteRequest; quote: ApiQuote }>(
    `/api/quote-requests/${quoteRequestId}/accept`,
    { method: "POST", body: JSON.stringify({ quoteId }) },
  );
}

export async function createPurchaseOrder(quoteId: string): Promise<ApiPurchaseOrder> {
  return api<ApiPurchaseOrder>("/api/purchase-orders", {
    method: "POST",
    body: JSON.stringify({ quoteId }),
  });
}

export async function listPurchaseOrders(spaceId?: string): Promise<ApiPurchaseOrder[]> {
  const path = spaceId
    ? `/api/purchase-orders?spaceId=${encodeURIComponent(spaceId)}`
    : "/api/purchase-orders";
  const data = await api<{ items: ApiPurchaseOrder[] }>(path);
  return data.items;
}

export async function approvePurchaseOrder(id: string): Promise<ApiPurchaseOrder> {
  return api<ApiPurchaseOrder>(`/api/purchase-orders/${id}/approve`, { method: "POST" });
}

export async function fulfillPurchaseOrder(id: string): Promise<ApiPurchaseOrder> {
  return api<ApiPurchaseOrder>(`/api/purchase-orders/${id}/fulfill`, { method: "POST" });
}

export async function listPaymentIntents(spaceId?: string): Promise<ApiPaymentIntent[]> {
  const path = spaceId
    ? `/api/payment-intents?spaceId=${encodeURIComponent(spaceId)}`
    : "/api/payment-intents";
  const data = await api<{ items: ApiPaymentIntent[] }>(path);
  return data.items;
}

export async function approvePaymentIntent(id: string): Promise<ApiPaymentIntent> {
  return api<ApiPaymentIntent>(`/api/payment-intents/${id}/approve`, { method: "POST" });
}

export async function confirmPaymentIntent(id: string): Promise<ApiPaymentIntent> {
  return api<ApiPaymentIntent>(`/api/payment-intents/${id}/confirm`, { method: "POST" });
}

export async function listPaymentRecords(
  paymentIntentId: string,
): Promise<ApiPaymentRecord[]> {
  const data = await api<{ items: ApiPaymentRecord[] }>(
    `/api/payment-intents/${paymentIntentId}/records`,
  );
  return data.items;
}

// --- Outreach ---------------------------------------------------------------

export type OutreachChannel = "whatsapp" | "email" | "matrix" | "web";
export type OutreachCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type OutreachSendStatus =
  | "queued"
  | "delegated"
  | "sent"
  | "replied"
  | "completed"
  | "failed";

export interface OutreachList {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  memberPersonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OutreachListMember {
  personId: string;
  actorId: string;
  email: string | null;
  displayName: string;
  addedAt: string;
}

export interface OutreachCampaign {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  listId: string;
  agentId: string;
  goal: string;
  status: OutreachCampaignStatus;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachStep {
  id: string;
  campaignId: string;
  position: number;
  sendAfterDays: number;
  channel: OutreachChannel;
  subject: string;
  template: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachSend {
  id: string;
  campaignId: string;
  stepId: string;
  personId: string;
  status: OutreachSendStatus;
  scheduledAt: string;
  taskId: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachCampaignDetail {
  campaign: OutreachCampaign;
  steps: OutreachStep[];
  sends: OutreachSend[];
  list: { id: string; name: string; memberCount: number } | null;
  agent: {
    id: string;
    actorId: string;
    displayName: string;
    role: string | null;
  } | null;
}

export async function listOutreachLists(spaceId: string): Promise<OutreachList[]> {
  const data = await api<{ items: OutreachList[] }>(
    `/api/outreach/lists?spaceId=${encodeURIComponent(spaceId)}`,
  );
  return data.items;
}

export async function createOutreachList(input: {
  spaceId: string;
  name: string;
  description?: string;
  memberPersonIds?: string[];
}): Promise<OutreachList> {
  return api<OutreachList>("/api/outreach/lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOutreachList(
  id: string,
  input: { name?: string; description?: string },
): Promise<OutreachList> {
  return api<OutreachList>(`/api/outreach/lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteOutreachList(id: string): Promise<void> {
  await api<void>(`/api/outreach/lists/${id}`, { method: "DELETE" });
}

export async function getOutreachListMembers(
  id: string,
): Promise<OutreachListMember[]> {
  const data = await api<{ items: OutreachListMember[] }>(
    `/api/outreach/lists/${id}/members`,
  );
  return data.items;
}

export async function addOutreachListMembers(
  id: string,
  personIds: string[],
): Promise<string[]> {
  const data = await api<{ items: string[] }>(`/api/outreach/lists/${id}/members`, {
    method: "POST",
    body: JSON.stringify({ personIds }),
  });
  return data.items;
}

export async function removeOutreachListMembers(
  id: string,
  personIds: string[],
): Promise<string[]> {
  const data = await api<{ items: string[] }>(`/api/outreach/lists/${id}/members`, {
    method: "DELETE",
    body: JSON.stringify({ personIds }),
  });
  return data.items;
}

export async function listOutreachCampaigns(
  spaceId: string,
): Promise<OutreachCampaign[]> {
  const data = await api<{ items: OutreachCampaign[] }>(
    `/api/outreach/campaigns?spaceId=${encodeURIComponent(spaceId)}`,
  );
  return data.items;
}

export interface CreateOutreachCampaignInput {
  spaceId: string;
  name: string;
  description?: string;
  listId: string;
  agentId: string;
  goal: string;
  steps?: Array<{
    position?: number;
    sendAfterDays?: number;
    channel?: OutreachChannel;
    subject?: string;
    template?: string;
    instructions?: string;
  }>;
}

export async function createOutreachCampaign(
  input: CreateOutreachCampaignInput,
): Promise<OutreachCampaign> {
  return api<OutreachCampaign>("/api/outreach/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getOutreachCampaignDetail(
  id: string,
): Promise<OutreachCampaignDetail> {
  return api<OutreachCampaignDetail>(`/api/outreach/campaigns/${id}`);
}

export async function updateOutreachCampaign(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    listId: string;
    agentId: string;
    goal: string;
    status: OutreachCampaignStatus;
  }>,
): Promise<OutreachCampaign> {
  return api<OutreachCampaign>(`/api/outreach/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteOutreachCampaign(id: string): Promise<void> {
  await api<void>(`/api/outreach/campaigns/${id}`, { method: "DELETE" });
}

export async function activateOutreachCampaign(id: string): Promise<OutreachCampaign> {
  return api<OutreachCampaign>(`/api/outreach/campaigns/${id}/activate`, {
    method: "POST",
  });
}

export async function pauseOutreachCampaign(id: string): Promise<OutreachCampaign> {
  return api<OutreachCampaign>(`/api/outreach/campaigns/${id}/pause`, {
    method: "POST",
  });
}

export async function completeOutreachCampaign(id: string): Promise<OutreachCampaign> {
  return api<OutreachCampaign>(`/api/outreach/campaigns/${id}/complete`, {
    method: "POST",
  });
}

export async function addOutreachStep(
  campaignId: string,
  input: {
    position?: number;
    sendAfterDays?: number;
    channel?: OutreachChannel;
    subject?: string;
    template?: string;
    instructions?: string;
  },
): Promise<OutreachStep> {
  return api<OutreachStep>(`/api/outreach/campaigns/${campaignId}/steps`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOutreachStep(
  campaignId: string,
  stepId: string,
  input: Partial<{
    position: number;
    sendAfterDays: number;
    channel: OutreachChannel;
    subject: string;
    template: string;
    instructions: string;
  }>,
): Promise<OutreachStep> {
  return api<OutreachStep>(
    `/api/outreach/campaigns/${campaignId}/steps/${stepId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteOutreachStep(
  campaignId: string,
  stepId: string,
): Promise<void> {
  await api<void>(`/api/outreach/campaigns/${campaignId}/steps/${stepId}`, {
    method: "DELETE",
  });
}

// --- Lead generation & enrichment --------------------------------------------

export type LeadProviderKind = "api" | "composio" | "mcp";

export interface LeadProviderView {
  id: string;
  label: string;
  kind: LeadProviderKind;
  configured: boolean;
  detail: string;
}

export interface LeadArea {
  place: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  polygon?: Array<{ lat: number; lng: number }>;
}

export interface LeadPersona {
  titles: string[];
  seniority: string[];
  functions: string[];
  industries: string[];
  companySizes: string[];
  keywords: string[];
  excludeEmails: string[];
  summary: string;
}

export type LeadListStatus = "draft" | "queued" | "running" | "complete" | "failed";

export interface LeadList {
  id: string;
  organizationId: string | null;
  spaceId: string;
  createdBy: string | null;
  name: string;
  description: string;
  persona: LeadPersona;
  area: LeadArea | null;
  providerId: string;
  providerConfig: Record<string, unknown>;
  status: LeadListStatus;
  error: string | null;
  leadCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadView {
  id: string;
  leadListId: string;
  personId: string;
  providerId: string;
  status: "new" | "contacted" | "qualified" | "converted";
  person: {
    id: string;
    actorId: string;
    displayName: string;
    email: string | null;
    title: string;
    seniority: string;
    company: string;
    industry: string;
    companySize: string;
    location: string;
    linkedinUrl: string | null;
  } | null;
}

export interface LeadRunResult {
  listId: string;
  status: LeadListStatus;
  totalFound: number;
  added: number;
  skipped: number;
  error: string | null;
}

export interface CreateLeadListInput {
  spaceId: string;
  organizationId?: string | null;
  name: string;
  description?: string;
  persona?: Partial<LeadPersona>;
  area?: LeadArea | null;
  providerId: string;
  providerConfig?: Record<string, unknown>;
}

export async function createLeadList(input: CreateLeadListInput): Promise<LeadList> {
  return api<LeadList>("/api/lead-lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listLeadLists(
  spaceId: string,
  organizationId?: string | null,
): Promise<LeadList[]> {
  const params = new URLSearchParams({ spaceId });
  if (organizationId) params.set("organizationId", organizationId);
  const data = await api<{ items: LeadList[] }>(`/api/lead-lists?${params.toString()}`);
  return data.items;
}

export async function getLeadList(id: string): Promise<LeadList> {
  return api<LeadList>(`/api/lead-lists/${id}`);
}

export async function updateLeadList(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    persona: LeadPersona;
    area: LeadArea | null;
    providerId: string;
    providerConfig: Record<string, unknown>;
  }>,
): Promise<LeadList> {
  return api<LeadList>(`/api/lead-lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteLeadList(id: string): Promise<void> {
  await api<void>(`/api/lead-lists/${id}`, { method: "DELETE" });
}

export async function listLeadProviders(
  spaceId: string,
  organizationId?: string | null,
): Promise<LeadProviderView[]> {
  const params = new URLSearchParams({ spaceId });
  if (organizationId) params.set("organizationId", organizationId);
  const data = await api<{ items: LeadProviderView[] }>(
    `/api/lead-providers?${params.toString()}`,
  );
  return data.items;
}

export async function runLeadList(id: string, limit?: number): Promise<LeadRunResult> {
  return api<LeadRunResult>(`/api/lead-lists/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ limit }),
  });
}

export async function listLeadListLeads(id: string): Promise<LeadView[]> {
  const data = await api<{ items: LeadView[] }>(`/api/lead-lists/${id}/leads`);
  return data.items;
}

export async function enrichLead(
  listId: string,
  personId: string,
): Promise<{ id: string }> {
  return api<{ id: string }>(
    `/api/lead-lists/${listId}/leads/${personId}/enrich`,
    { method: "POST" },
  );
}

// --- Vibe DREAM Configurator: organizational graph ---------------------------

export type OrgNodeKind =
  | "dream"
  | "team"
  | "human"
  | "agent"
  | "responsibility"
  | "tool"
  | "heartbeat";

export type OrgEdgeRelation =
  | "requires"
  | "owns"
  | "member_of"
  | "responsible_for"
  | "uses"
  | "has_access_to"
  | "monitors"
  | "invokes"
  | "depends_on";

export interface OrgNodePosition {
  x: number;
  y: number;
}

export interface OrgNode {
  id: string;
  organizationId: string;
  kind: OrgNodeKind;
  name: string;
  refId: string | null;
  config: Record<string, unknown>;
  position: OrgNodePosition;
  createdAt: string;
  updatedAt: string;
}

export interface OrgEdge {
  id: string;
  organizationId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: OrgEdgeRelation;
  metadata: Record<string, unknown>;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgGraph {
  nodes: OrgNode[];
  edges: OrgEdge[];
}

export interface CreateOrgNodeInput {
  kind: OrgNodeKind;
  name: string;
  refId?: string | null;
  config?: Record<string, unknown>;
  position?: OrgNodePosition;
}

export interface UpdateOrgNodeInput {
  name?: string;
  config?: Record<string, unknown>;
  position?: OrgNodePosition;
}

export interface CreateOrgEdgeInput {
  fromNodeId: string;
  toNodeId: string;
  relation: OrgEdgeRelation;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatConfig {
  schedule: string;
  monitors: string[];
  actions: string[];
  enabled: boolean;
}

export interface ReadinessDimension {
  key: string;
  label: string;
  score: number;
  missing: string[];
}

export interface ReadinessReport {
  dimensions: ReadinessDimension[];
  overall: number;
  jamot: boolean;
  updatedAt: string;
}

export async function getOrgGraph(orgId: string): Promise<OrgGraph> {
  return api<OrgGraph>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph`,
  );
}

export async function createOrgNode(
  orgId: string,
  input: CreateOrgNodeInput,
): Promise<OrgNode> {
  return api<OrgNode>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph/nodes`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateOrgNode(
  orgId: string,
  nodeId: string,
  patch: UpdateOrgNodeInput,
): Promise<OrgNode> {
  return api<OrgNode>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph/nodes/${encodeURIComponent(nodeId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deleteOrgNode(
  orgId: string,
  nodeId: string,
): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph/nodes/${encodeURIComponent(nodeId)}`,
    { method: "DELETE" },
  );
}

export async function createOrgEdge(
  orgId: string,
  input: CreateOrgEdgeInput,
): Promise<OrgEdge> {
  return api<OrgEdge>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph/edges`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteOrgEdge(
  orgId: string,
  edgeId: string,
): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(
    `/api/organizations/${encodeURIComponent(orgId)}/graph/edges/${encodeURIComponent(edgeId)}`,
    { method: "DELETE" },
  );
}

export async function getReadiness(orgId: string): Promise<ReadinessReport> {
  return api<ReadinessReport>(
    `/api/organizations/${encodeURIComponent(orgId)}/readiness`,
  );
}

export async function getJamot(orgId: string): Promise<{
  jamot: boolean;
  overall: number;
}> {
  return api<{ jamot: boolean; overall: number }>(
    `/api/organizations/${encodeURIComponent(orgId)}/jamot`,
  );
}

export interface DreamConfig {
  objective: string;
  outcomes: string[];
  kpis: Array<{ name: string; target: string; unit: string }>;
  constraints: string[];
  timeline: Array<{ milestone: string; by: string }>;
  requiredCapabilities: string[];
  requiredResponsibilities: string[];
}

export async function updateDreamConfig(
  orgId: string,
  config: DreamConfig,
): Promise<{ node: OrgNode; dream: DreamConfig }> {
  return api<{ node: OrgNode; dream: DreamConfig }>(
    `/api/organizations/${encodeURIComponent(orgId)}/dream`,
    { method: "PUT", body: JSON.stringify(config) },
  );
}