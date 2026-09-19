import { z } from "zod";
import { Id, Provenance, Timestamp } from "./common.js";

/**
 * A person's profile is layered and every derived attribute is provable.
 * Nothing here is a "fact" unless the source says so.
 */
export const ProfileAttribute = Provenance.extend({
  value: z.unknown(),
});

export const PersonProfile = z.object({
  selfDescribed: z.record(z.string(), ProfileAttribute).default({}),
  integral: z.record(z.string(), ProfileAttribute).default({}),
  skills: z.array(z.string()).default([]),
  preferences: z.record(z.string(), ProfileAttribute).default({}),
  goals: z.array(z.string()).default([]),
});

/** Privacy/consent controls — the person owns their data. */
export const Consent = z.object({
  exportEnabled: z.boolean().default(true),
  visibility: z.enum(["private", "org", "public"]).default("private"),
  allowInference: z.boolean().default(true),
});
export type Consent = z.infer<typeof Consent>;

export const Person = z.object({
  id: Id,
  actorId: Id,
  email: z.string().email().nullable(),
  firstName: z.string().nullable().default(null),
  lastName: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  avatarUrl: z.string().nullable().default(null),
  avatarSource: z.string().nullable().default(null),
  consent: Consent.nullable().default(null),
  lastInteractionAt: Timestamp.nullable().default(null),
  /** Concise, LLM-maintained summary of who this person is, rebuilt from their memory entries. */
  contextSummary: z.string().nullable().default(null),
  contextSummaryUpdatedAt: Timestamp.nullable().default(null),
  profile: PersonProfile,
  /** Space IDs this person participates in (organizations + personal). */
  membershipSpaceIds: z.array(Id).default([]),
  reputation: z.record(z.string(), z.number()).default({}),
  /** Opaque id for this person's unauthenticated public profile page. */
  publicToken: z.string().nullable().default(null),
  createdAt: Timestamp.optional(),
  updatedAt: Timestamp.optional(),
});
export type Person = z.infer<typeof Person>;
export type PersonProfile = z.infer<typeof PersonProfile>;

/**
 * Lightweight person row for lists/tables. Display identity follows the
 * priority: First Last → phone → email → channel identifier. Never fabricated.
 */
export const PersonSummary = z.object({
  id: Id,
  actorId: Id,
  displayName: z.string(),
  firstName: z.string().nullable().default(null),
  lastName: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  avatarUrl: z.string().nullable().default(null),
  /** Channel providers this person is reachable on (whatsapp, telegram, ...). */
  channels: z.array(z.string()).default([]),
  /** Primary relationship/role label in the current organization, if any. */
  relationship: z.string().nullable().default(null),
  lastInteractionAt: Timestamp.nullable().default(null),
  createdAt: Timestamp.optional(),
});
export type PersonSummary = z.infer<typeof PersonSummary>;

export const PeoplePage = z.object({
  items: z.array(PersonSummary),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
});
export type PeoplePage = z.infer<typeof PeoplePage>;

/**
 * A named grouping of people inside one space — the "lists" the People screen
 * is built around. Membership is explicit: a person can sit in several lists,
 * or in none, and deleting a list never deletes the people in it.
 */
export const PeopleList = z.object({
  id: Id,
  spaceId: Id,
  organizationId: Id.nullable().default(null),
  createdBy: Id.nullable().default(null),
  name: z.string().min(1),
  /** Agent that answers inbound messages from anyone on this list. */
  replyAgentId: Id.nullable().default(null),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type PeopleList = z.infer<typeof PeopleList>;

export const PeopleListMember = z.object({
  id: Id,
  peopleListId: Id,
  personId: Id,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type PeopleListMember = z.infer<typeof PeopleListMember>;

/**
 * A person as the People screen needs them: the summary plus the CRM fields
 * that live in `profile.selfDescribed` (website, public profile, context,
 * aura, notes), lifted out so the screen does not have to know that layout.
 */
export const PeopleListPerson = PersonSummary.extend({
  website: z.string().default(""),
  /** The person's own public profile URL, empty until they are onboarded. */
  publicProfile: z.string().default(""),
  context: z.string().default(""),
  aura: z.number().min(0).max(100).default(0),
  notes: z.array(z.object({ when: z.string(), text: z.string() })).default([]),
  /** Auto-maintained from this person's memory entries — distinct from `context` above. */
  contextSummary: z.string().nullable().default(null),
  contextSummaryUpdatedAt: Timestamp.nullable().default(null),
});
export type PeopleListPerson = z.infer<typeof PeopleListPerson>;

/** A list together with the people in it, in the order they were added. */
export const PeopleListWithMembers = PeopleList.extend({
  people: z.array(PeopleListPerson).default([]),
});
export type PeopleListWithMembers = z.infer<typeof PeopleListWithMembers>;
