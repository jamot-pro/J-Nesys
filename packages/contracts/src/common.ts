import { z } from "zod";

/** Canonical string identifier (UUID). */
export const Id = z.string().uuid().brand<"Id">();
export type Id = z.infer<typeof Id>;

/** ISO 8601 timestamp. */
export const Timestamp = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

/**
 * Provenance for every derived attribute. AI inference must never silently
 * become an immutable fact — every value carries where it came from.
 */
export const Provenance = z.object({
  source: z.enum([
    "self_declared",
    "assessment",
    "observed",
    "manager_feedback",
    "inferred",
    "system",
  ]),
  confidence: z.number().min(0).max(1).default(0.5),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Provenance = z.infer<typeof Provenance>;

/** Generic timestamped entity base. */
export const EntityBase = z.object({
  id: Id,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type EntityBase = z.infer<typeof EntityBase>;

/** Pagination envelope. */
export const Pagination = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(200).default(50),
});
export type Pagination = z.infer<typeof Pagination>;

export const Page = z.object({
  items: z.array(z.unknown()),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
});
export type Page = z.infer<typeof Page>;
