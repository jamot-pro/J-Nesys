import { z } from "zod";
import { EntityBase, Id, Timestamp } from "./common.js";

/**
 * Lead generation & enrichment domain.
 *
 * A research campaign ("Lead List") captures a target area drawn on a map, a
 * target persona, and a configured provider (Apollo.io, a Composio-connected
 * toolkit, an MCP server, …). Running it produces RawLeads that are normalized,
 * enriched, and written into Jamot People (Person rows) grouped under the list,
 * with full provenance.
 */

/** A single point on the map. */
export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

/** Geographic selection drawn on the map: a radius around a center, or a polygon. */
export const LeadArea = z.object({
  /** Human label for the area, e.g. the geocoded place name. */
  place: z.string().default(""),
  center: LatLng.optional(),
  radiusKm: z.number().min(0).optional(),
  polygon: z.array(LatLng).min(3).optional(),
});
export type LeadArea = z.infer<typeof LeadArea>;

/** Target persona filters (normalized from natural language). */
export const LeadPersona = z.object({
  titles: z.array(z.string()).default([]),
  seniority: z.array(z.string()).default([]),
  functions: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  companySizes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  excludeEmails: z.array(z.string()).default([]),
  /** Free-text description preserved for provenance / re-runs. */
  summary: z.string().default(""),
});
export type LeadPersona = z.infer<typeof LeadPersona>;

/** Full criteria handed to a provider. */
export const LeadCriteria = z.object({
  area: LeadArea.optional(),
  persona: LeadPersona.default({}),
  /** Cap on the number of leads to return. */
  limit: z.number().int().min(1).max(1000).default(100),
});
export type LeadCriteria = z.infer<typeof LeadCriteria>;

export const LeadProviderKind = z.enum(["api", "composio", "mcp"]);
export type LeadProviderKind = z.infer<typeof LeadProviderKind>;

/** A provider's declared availability for a given org/space. */
export const LeadProviderView = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: LeadProviderKind,
  configured: z.boolean(),
  /** Optional details, e.g. the connected Composio toolkit. */
  detail: z.string().default(""),
});
export type LeadProviderView = z.infer<typeof LeadProviderView>;

/**
 * A normalized lead as returned by a provider. Field names are the canonical
 * firmographics the rest of the platform consumes; `raw` keeps the original
 * provider payload for provenance.
 */
export const RawLead = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().email().nullable().default(null),
  phone: z.string().nullable().default(null),
  title: z.string().default(""),
  seniority: z.string().default(""),
  company: z.string().default(""),
  industry: z.string().default(""),
  companySize: z.string().default(""),
  location: z.string().default(""),
  hqLocation: z.string().default(""),
  linkedinUrl: z.string().url().nullable().default(null),
  website: z.string().url().nullable().default(null),
  /** Provider-provided confidence (0..1) where available. */
  confidence: z.number().min(0).max(1).optional(),
  /** Free-form extra attributes surfaced in the UI. */
  extra: z.record(z.string(), z.unknown()).default({}),
  /** Original provider payload. */
  raw: z.record(z.string(), z.unknown()).default({}),
});
export type RawLead = z.infer<typeof RawLead>;

export const LeadListStatus = z.enum([
  "draft",
  "queued",
  "running",
  "complete",
  "failed",
]);
export type LeadListStatus = z.infer<typeof LeadListStatus>;

/** A research campaign: map area + persona + provider + collected leads. */
export const LeadList = EntityBase.extend({
  organizationId: Id.nullable().default(null),
  spaceId: Id,
  createdBy: Id.nullable().default(null),
  name: z.string().min(1),
  description: z.string().default(""),
  persona: LeadPersona.default({}),
  area: LeadArea.nullable().default(null),
  providerId: z.string().min(1),
  providerConfig: z.record(z.string(), z.unknown()).default({}),
  status: LeadListStatus.default("draft"),
  error: z.string().nullable().default(null),
  leadCount: z.number().int().min(0).default(0),
  lastRunAt: Timestamp.nullable().default(null),
});
export type LeadList = z.infer<typeof LeadList>;

export const LeadListMemberStatus = z.enum([
  "new",
  "contacted",
  "qualified",
  "converted",
]);
export type LeadListMemberStatus = z.infer<typeof LeadListMemberStatus>;

/** A lead attached to a research list, joined to its Person row. */
export const LeadListMember = EntityBase.extend({
  leadListId: Id,
  personId: Id,
  providerId: z.string().min(1),
  status: LeadListMemberStatus.default("new"),
  /** Raw provider payload at collection time (provenance). */
  raw: z.record(z.string(), z.unknown()).default({}),
  /** Provenance snapshot: list, area, persona, source at the moment of capture. */
  provenance: z.record(z.string(), z.unknown()).default({}),
});
export type LeadListMember = z.infer<typeof LeadListMember>;

/** Output of a lead-generation run. */
export const LeadRunResult = z.object({
  listId: Id,
  status: LeadListStatus,
  totalFound: z.number().int().min(0),
  added: z.number().int().min(0),
  skipped: z.number().int().min(0),
  error: z.string().nullable().default(null),
});
export type LeadRunResult = z.infer<typeof LeadRunResult>;

export const CreateLeadList = z.object({
  spaceId: Id,
  organizationId: Id.nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  persona: LeadPersona.optional(),
  area: LeadArea.nullable().optional(),
  providerId: z.string().min(1),
  providerConfig: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLeadList = z.infer<typeof CreateLeadList>;

export const UpdateLeadList = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  persona: LeadPersona.optional(),
  area: LeadArea.nullable().optional(),
  providerId: z.string().min(1).optional(),
  providerConfig: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLeadList = z.infer<typeof UpdateLeadList>;