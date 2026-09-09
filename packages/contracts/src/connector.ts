import { z } from "zod";
import { EntityBase, Id } from "./common.js";

export const ConnectorProvider = z.enum([
  "whatsapp",
  "telegram",
  "google_calendar",
  "github",
  "stripe",
  "erp",
  "database",
  "matrix",
  "discord",
  "custom",
  "composio",
  "google",
]);
export type ConnectorProvider = z.infer<typeof ConnectorProvider>;

export const ConnectorType = z.enum([
  "channel",
  "mcp",
  "harness",
  "ai_provider",
  "data",
]);
export type ConnectorType = z.infer<typeof ConnectorType>;

/** Where a connection is shared. `user` = only the owning user (personal
 * space or user-private within an org); `organization` = shared to every
 * member of the owning organization. */
export const ConnectorSharing = z.enum(["user", "organization"]);
export type ConnectorSharing = z.infer<typeof ConnectorSharing>;

/**
 * Configuration stored on a `provider: "composio"` connector row. Mirrors a
 * single Composio connected account, keyed by a tenant-scoped Composio
 * `user_id` so connected accounts are isolated per Jamot scope.
 */
export const ComposioConnectionConfig = z.object({
  toolkit: z.string(),
  connectedAccountId: z.string(),
  composioUserId: z.string(),
  accountStatus: z.string().optional(),
  mcpUrl: z.string().optional(),
  mcpHeaders: z.record(z.string(), z.string()).optional(),
});
export type ComposioConnectionConfig = z.infer<typeof ComposioConnectionConfig>;

/**
 * Credential reference — never the secret itself. Resolution order:
 * user → organization → system → environment.
 */
export const SecretRef = z.object({
  /** Stable handle; the server resolves to a secret out of band. */
  ref: z.string().min(1),
  scope: z.enum(["user", "organization", "system", "environment"]),
});
export type SecretRef = z.infer<typeof SecretRef>;

/** Authenticated bridge to an external system. */
export const Connector = EntityBase.extend({
  provider: ConnectorProvider,
  type: ConnectorType.default("channel"),
  ownerActorId: Id.nullable(),
  ownerOrganizationId: Id.nullable(),
  sharing: ConnectorSharing.default("user"),
  capabilities: z.array(z.string()).default([]),
  credentialRef: SecretRef,
  scopes: z.array(z.string()).default([]),
  configuration: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["connected", "disconnected", "error"]).default("disconnected"),
});
export type Connector = z.infer<typeof Connector>;
