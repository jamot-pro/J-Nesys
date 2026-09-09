import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** An app manifest an org registered itself, beyond the built-in catalog.
 * `slug` (not `id`) is the opaque string used everywhere a built-in
 * AppManifest's `id` is used (enabledAppIds, /apps/:id lookups) - `id` here
 * is just the DB row identity. */
export const CustomAppManifest = EntityBase.extend({
  organizationId: Id,
  slug: z.string().min(1),
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  description: z.string().default(""),
  entities: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
  canvas: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  createdByActorId: Id,
});
export type CustomAppManifest = z.infer<typeof CustomAppManifest>;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const CreateCustomAppBody = z.object({
  slug: z.string().regex(SLUG_RE, "slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  entities: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
  hooks: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  canvas: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});
export type CreateCustomAppBody = z.infer<typeof CreateCustomAppBody>;
