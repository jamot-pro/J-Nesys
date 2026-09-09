import { z } from "zod";
import { EntityBase, Id, Timestamp } from "./common.js";

export const SpaceKind = z.enum(["personal", "organization"]);
export type SpaceKind = z.infer<typeof SpaceKind>;

/** Execution and ownership boundary. */
export const Space = EntityBase.extend({
  kind: SpaceKind,
  ownerActorId: Id,
  /** For personal spaces this is the person; for orgs the organization. */
  name: z.string().min(1),
});
export type Space = z.infer<typeof Space>;

export const Organization = EntityBase.extend({
  spaceId: Id,
  /** Subdomain slug: <slug>.jamot.pro resolves to this organization. */
  slug: z.string().nullable().default(null),
  /** Self-hosted upload path (/uploads/...) or absolute URL for the org logo. */
  logoUrl: z.string().nullable().default(null),
  dream: z.string().default(""),
  blueprint: z.record(z.string(), z.unknown()).default({}),
  /** Ids of apps in the App Registry that are enabled/allocated for this org. */
  enabledAppIds: z.array(z.string()).default([]),
  treasuryId: Id.nullable(),
  reputation: z.record(z.string(), z.number()).default({}),
});
export type Organization = z.infer<typeof Organization>;

/** A workspace is an org-owned space: the data container for one tenant.
 * Every workspace maps 1:1 to a Space, which keys all tenant data. */
export const Workspace = EntityBase.extend({
  organizationId: Id,
  spaceId: Id,
  name: z.string().min(1),
  /** Workspace-level configuration (isolated per workspace). */
  config: z.record(z.string(), z.unknown()).default({}),
});
export type Workspace = z.infer<typeof Workspace>;

/** Relationship between an Actor and a Space. */
export const Role = EntityBase.extend({
  actorId: Id,
  spaceId: Id,
  kind: z.enum(["owner", "admin", "member", "agent", "external"]),
  title: z.string().nullable(),
});
export type Role = z.infer<typeof Role>;

/** A place in an Organization's OrganicChart. Binds one Human or Agent. */
export const Position = EntityBase.extend({
  organizationId: Id,
  chartId: Id,
  title: z.string().min(1),
  parentPositionId: Id.nullable(),
  /** The actor currently holding the position (human or agent). */
  holderActorId: Id.nullable(),
});
export type Position = z.infer<typeof Position>;

export const OrganicChart = EntityBase.extend({
  organizationId: Id,
  name: z.string().min(1),
  rootPositionId: Id.nullable(),
});
export type OrganicChart = z.infer<typeof OrganicChart>;

/** Role a human member can hold inside an organization. */
export const OrgMemberRoleKind = z.enum(["owner", "admin", "member"]);
export type OrgMemberRoleKind = z.infer<typeof OrgMemberRoleKind>;

/** A human member of an organization, for the team/member management UI. */
export const OrganizationMember = z.object({
  personId: Id,
  actorId: Id,
  email: z.string().email().nullable(),
  displayName: z.string(),
  kind: OrgMemberRoleKind,
  title: z.string().nullable(),
  membershipSince: Timestamp,
});
export type OrganizationMember = z.infer<typeof OrganizationMember>;

/** Body for allocating (enabling/disabling) apps on an organization. */
export const UpdateOrganizationApps = z.object({
  enabledAppIds: z.array(z.string()),
});
export type UpdateOrganizationApps = z.infer<typeof UpdateOrganizationApps>;

/** Super-admin-only org settings patch. */
export const UpdateOrganizationSettings = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  logoUrl: z.string().min(1).optional(),
  dream: z.string().optional(),
});
export type UpdateOrganizationSettings = z.infer<typeof UpdateOrganizationSettings>;

/** Body for the super-admin org delete (confirm-by-name). */
export const DeleteOrganizationBody = z.object({
  confirmName: z.string().min(1),
});
export type DeleteOrganizationBody = z.infer<typeof DeleteOrganizationBody>;

/** Body for org-admin workspace settings (name + isolated config). */
export const UpdateWorkspaceBody = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateWorkspaceBody = z.infer<typeof UpdateWorkspaceBody>;

/** Result of resolving an org by its subdomain slug. */
export const SubdomainResolution = z.object({
  organization: Organization,
  space: Space,
  workspaces: z.array(Workspace),
  role: z.enum(["owner", "admin", "member", "agent", "external"]).nullable(),
});
export type SubdomainResolution = z.infer<typeof SubdomainResolution>;
