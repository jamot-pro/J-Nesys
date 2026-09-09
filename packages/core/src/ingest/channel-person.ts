import type { Actor, Event, Identity, MergeCandidate, Person } from "@jamot/contracts";
import type { InboundMessage } from "../channels/channel.js";

/**
 * Channel → Identity resolution → Person.
 *
 * Every human who contacts the organization through any connected channel
 * resolves to ONE canonical Person with many channel identities attached.
 * Resolution is conservative: exact identity matches reuse the Person, and
 * uncertain collisions (same phone/email on a different Person) are recorded
 * as merge candidates for human review — never merged automatically.
 */

export interface ChannelPersonIngestRepo {
  findActorByIdentity(provider: string, value: string): Promise<Actor | null>;
  findPersonByActorId(actorId: string): Promise<Person | null>;
  findPersonByEmail(email: string): Promise<Person | null>;
  findPersonByPhone(phone: string): Promise<Person | null>;
  addIdentity(input: {
    actorId: string;
    personId?: string | null;
    provider: string;
    value: string;
    verified?: boolean;
    confidence?: number;
    source?: string;
  }): Promise<Identity>;
  createActor(input: {
    type: Actor["type"];
    source: Actor["source"];
    displayName: string;
    externalIdentities: Actor["externalIdentities"];
  }): Promise<Actor>;
  createPerson(input: {
    actorId: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    membershipSpaceIds: string[];
  }): Promise<Person>;
  updatePerson(
    id: string,
    patch: Partial<
      Pick<
        Person,
        | "firstName"
        | "lastName"
        | "phone"
        | "email"
        | "lastInteractionAt"
        | "membershipSpaceIds"
      >
    >,
  ): Promise<Person | null>;
  updateActor(
    id: string,
    patch: Partial<Pick<Actor, "displayName">>,
  ): Promise<Actor | null>;
  createMergeCandidate(input: {
    spaceId?: string | null;
    personAId: string;
    personBId: string;
    reason: string;
    detail?: Record<string, unknown>;
  }): Promise<MergeCandidate>;
  recordEvent(input: {
    type: string;
    spaceId?: string | null;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<Event>;
}

export interface ChannelProvisionResult {
  actor: Actor | null;
  person: Person | null;
  created: boolean;
}

export interface ChannelPersonProvisionerDeps {
  repo: ChannelPersonIngestRepo;
  /** Identity provider for a message; defaults to the channel kind. */
  providerOf?: (msg: InboundMessage) => string;
  /** Resolve the space a new contact should belong to from the channel. */
  spaceResolver?: (channelId: string) => Promise<string | undefined>;
}

export interface ChannelPersonProvisioner {
  handleInbound(msg: InboundMessage): Promise<ChannelProvisionResult>;
}

function normalizeValue(provider: string, sender: string): string {
  const trimmed = sender.trim();
  if (provider === "whatsapp") return trimmed.replace(/@.*$/, "");
  return trimmed;
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

interface ExtractedNames {
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

function extractNames(msg: InboundMessage): ExtractedNames {
  const raw = msg.raw as
    | {
        pushName?: unknown;
        from?: { first_name?: unknown; last_name?: unknown; username?: unknown };
      }
    | undefined;
  const clamp = (v: string) => v.slice(0, 120);

  if (msg.kind === "telegram") {
    const first = raw?.from?.first_name;
    const last = raw?.from?.last_name;
    const firstName = typeof first === "string" && first.trim() ? clamp(first.trim()) : undefined;
    const lastName = typeof last === "string" && last.trim() ? clamp(last.trim()) : undefined;
    if (firstName || lastName) {
      return { firstName, lastName, displayName: [firstName, lastName].filter(Boolean).join(" ") };
    }
  }

  const pushName = raw?.pushName;
  if (typeof pushName === "string" && pushName.trim()) {
    const name = clamp(pushName.trim());
    const parts = name.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    return { firstName, lastName, displayName: name };
  }

  return {};
}

export function createChannelPersonProvisioner(
  deps: ChannelPersonProvisionerDeps,
): ChannelPersonProvisioner {
  const { repo, spaceResolver } = deps;
  const providerOf = deps.providerOf ?? ((msg: InboundMessage) => msg.kind);

  async function enrich(
    person: Person,
    actor: Actor,
    names: ExtractedNames,
    msg: InboundMessage,
  ): Promise<Person> {
    let current = person;
    const patch: Parameters<ChannelPersonIngestRepo["updatePerson"]>[1] = {};

    if (!current.firstName && names.firstName) patch.firstName = names.firstName;
    if (!current.lastName && names.lastName) patch.lastName = names.lastName;
    if (msg.timestamp) patch.lastInteractionAt = msg.timestamp;

    if (Object.keys(patch).length > 0) {
      const updated = await repo.updatePerson(current.id, patch);
      if (updated) current = updated;
    }

    if (names.displayName && actor.displayName !== names.displayName) {
      const looksLikeIdentifier =
        actor.displayName === msg.sender || digitsOnly(actor.displayName).length >= 7;
      if (looksLikeIdentifier) {
        await repo.updateActor(actor.id, { displayName: names.displayName });
      }
    }

    return current;
  }

  return {
    async handleInbound(msg) {
      const provider = providerOf(msg);
      const value = normalizeValue(provider, msg.sender);
      if (!value) return { actor: null, person: null, created: false };

      const names = extractNames(msg);

      const existingActor = await repo.findActorByIdentity(provider, value);
      if (existingActor) {
        const person = await repo.findPersonByActorId(existingActor.id);
        if (person) {
          const updated = await enrich(person, existingActor, names, msg);
          return { actor: existingActor, person: updated, created: false };
        }
      }

      const spaceId = await spaceResolver?.(msg.channelId);
      const displayName = names.displayName ?? value;

      const actor = await repo.createActor({
        type: "human",
        source: "external",
        displayName,
        externalIdentities: [{ provider, value, verified: true }],
      });

      const phoneDigits = provider === "whatsapp" ? digitsOnly(value) : "";
      const person = await repo.createPerson({
        actorId: actor.id,
        email: provider === "email" ? value.toLowerCase() : null,
        firstName: names.firstName ?? null,
        lastName: names.lastName ?? null,
        phone: phoneDigits.length >= 7 ? phoneDigits : null,
        membershipSpaceIds: spaceId ? [spaceId] : [],
      });

      await repo.addIdentity({
        actorId: actor.id,
        personId: person.id,
        provider,
        value,
        verified: true,
        confidence: 1,
        source: provider,
      });

      await repo.recordEvent({
        type: "person.created",
        spaceId: spaceId ?? msg.spaceId ?? null,
        actorId: actor.id,
        payload: { personId: person.id, provider, value },
      });

      const collisions: { reason: string; value: string; otherId: string }[] = [];
      if (person.email) {
        const other = await repo.findPersonByEmail(person.email);
        if (other && other.id !== person.id) {
          collisions.push({ reason: "email", value: person.email, otherId: other.id });
        }
      }
      if (person.phone) {
        const other = await repo.findPersonByPhone(person.phone);
        if (other && other.id !== person.id) {
          collisions.push({ reason: "phone", value: person.phone, otherId: other.id });
        }
      }

      for (const collision of collisions) {
        await repo.createMergeCandidate({
          spaceId: spaceId ?? msg.spaceId ?? null,
          personAId: collision.otherId,
          personBId: person.id,
          reason: `${collision.reason} ${collision.value} matches another person`,
          detail: { provider, value },
        });
        await repo.recordEvent({
          type: "person.merge.proposed",
          spaceId: spaceId ?? msg.spaceId ?? null,
          actorId: actor.id,
          payload: {
            personAId: collision.otherId,
            personBId: person.id,
            reason: collision.reason,
          },
        });
      }

      return { actor, person, created: true };
    },
  };
}
