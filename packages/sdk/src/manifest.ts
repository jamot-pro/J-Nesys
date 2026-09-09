import { z } from "zod";

export const AppManifestSchema = z.object({
  id: z.string().min(1),
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
});
export type AppManifest = z.infer<typeof AppManifestSchema>;

export interface AppContext {
  spaceId: string;
  organizationType?: string;
  actorRole?: string;
  context?: Record<string, unknown>;
}
