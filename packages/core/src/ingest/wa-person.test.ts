import { describe, expect, it } from "vitest";
import type { Actor, Id, Person } from "@jamot/contracts";
import type { InboundMessage } from "../channels/channel.js";
import {
  createWhatsAppPersonProvisioner,
  WHATSAPP_IDENTITY_PROVIDER,
  type IngestRepo,
} from "./wa-person.js";

const SPACE = "00000000-0000-4000-8000-000000000001" as Id;

function actor(id: string, displayName: string, sender: string): Actor {
  return {
    id: id as Id,
    type: "human",
    source: "external",
    displayName,
    status: "active",
    externalIdentities: [
      { provider: WHATSAPP_IDENTITY_PROVIDER, value: sender, verified: true },
    ],
    personalSpaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function person(actorId: string): Person {
  return {
    id: "00000000-0000-4000-8000-000000000099" as Id,
    actorId: actorId as Id,
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    avatarUrl: null,
    avatarSource: null,
    consent: null,
    lastInteractionAt: null,
    profile: { selfDescribed: {}, integral: {}, skills: [], preferences: {}, goals: [] },
    membershipSpaceIds: [SPACE],
    reputation: {},
  };
}

function msg(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channelId: "acct-1",
    kind: "whatsapp",
    sender: "16508665016",
    text: "hi",
    timestamp: "2026-08-19T00:00:00.000Z",
    ...overrides,
  };
}

export interface FakeRepoState {
  identities: { actorId: string; personId: string | null; provider: string; value: string }[];
  mergeCandidates: { personAId: string; personBId: string; reason: string }[];
  events: { type: string; payload?: Record<string, unknown> }[];
}

function fakeRepo(
  init: { actors?: Actor[]; people?: Person[] } = {},
): IngestRepo & { state: FakeRepoState } {
  const actors = new Map<string, Actor>((init.actors ?? []).map((a) => [a.id, a]));
  const people = new Map<string, Person>((init.people ?? []).map((p) => [p.actorId, p]));
  const state: FakeRepoState = { identities: [], mergeCandidates: [], events: [] };
  const repo: IngestRepo & { state: FakeRepoState } = {
    state,
    async findActorByIdentity(provider, value) {
      const identity = state.identities.find(
        (i) => i.provider === provider && i.value === value,
      );
      if (identity) return actors.get(identity.actorId) ?? null;
      for (const a of actors.values()) {
        if (a.externalIdentities.some((i) => i.provider === provider && i.value === value)) {
          return a;
        }
      }
      return null;
    },
    async findPersonByActorId(actorId) {
      return people.get(actorId) ?? null;
    },
    async findPersonByEmail(email) {
      for (const p of people.values()) {
        if (p.email?.toLowerCase() === email.toLowerCase()) return p;
      }
      return null;
    },
    async findPersonByPhone(phone) {
      for (const p of people.values()) {
        if (p.phone === phone) return p;
      }
      return null;
    },
    async addIdentity(input) {
      state.identities.push({
        actorId: input.actorId,
        personId: input.personId ?? null,
        provider: input.provider,
        value: input.value,
      });
      return {
        id: `identity-${state.identities.length}` as Id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actorId: input.actorId as Id,
        personId: (input.personId ?? null) as Id | null,
        provider: input.provider,
        value: input.value,
        verified: input.verified ?? true,
        confidence: input.confidence ?? 1,
        source: input.source ?? "observed",
      };
    },
    async createActor(input) {
      const a = actor("new-actor", input.displayName, input.externalIdentities[0]!.value);
      actors.set(a.id, a);
      return a;
    },
    async createPerson(input) {
      const p = {
        ...person(input.actorId),
        email: input.email ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        membershipSpaceIds: input.membershipSpaceIds as Id[],
      };
      people.set(input.actorId, p);
      return p;
    },
    async updatePerson(id, patch) {
      for (const [actorId, p] of people.entries()) {
        if (p.id === id) {
          const updated = { ...p, ...patch };
          people.set(actorId, updated);
          return updated;
        }
      }
      return null;
    },
    async updateActor(id, patch) {
      const existing = actors.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      actors.set(id, updated);
      return updated;
    },
    async createMergeCandidate(input) {
      state.mergeCandidates.push({
        personAId: input.personAId,
        personBId: input.personBId,
        reason: input.reason,
      });
      return {
        id: "merge-1" as Id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        spaceId: (input.spaceId ?? null) as Id | null,
        personAId: input.personAId as Id,
        personBId: input.personBId as Id,
        reason: input.reason,
        detail: input.detail ?? {},
        status: "pending" as const,
      };
    },
    async recordEvent(input) {
      state.events.push({ type: input.type, payload: input.payload });
      return {
        id: "event-1" as Id,
        type: input.type,
        spaceId: (input.spaceId ?? null) as Id | null,
        actorId: (input.actorId ?? null) as Id | null,
        idempotencyKey: "k",
        payload: input.payload ?? {},
        occurredAt: new Date().toISOString(),
        delivered: false,
      };
    },
  };
  return repo;
}

describe("whatsapp person provisioner", () => {
  it("creates an actor + person for a new sender", async () => {
    const repo = fakeRepo();
    const provisioner = createWhatsAppPersonProvisioner({
      repo,
      spaceResolver: async () => SPACE,
    });

    const result = await provisioner.handleInbound(msg());

    expect(result.created).toBe(true);
    expect(result.actor).toMatchObject({
      type: "human",
      source: "external",
      displayName: "16508665016",
      externalIdentities: [
        { provider: "whatsapp", value: "16508665016", verified: true },
      ],
    });
    expect(result.person?.membershipSpaceIds).toEqual([SPACE]);
  });

  it("reuses an existing actor and never creates a duplicate", async () => {
    const existing = actor("existing-actor", "Existing", "16508665016");
    const repo = fakeRepo({ actors: [existing], people: [person("existing-actor")] });
    const provisioner = createWhatsAppPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(msg());

    expect(result.created).toBe(false);
    expect(result.actor?.id).toBe("existing-actor");
    expect(result.person?.actorId).toBe("existing-actor");
  });

  it("uses the WhatsApp push name as the display name", async () => {
    const repo = fakeRepo();
    const provisioner = createWhatsAppPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(
      msg({ raw: { pushName: "Jane Doe" } }),
    );

    expect(result.actor?.displayName).toBe("Jane Doe");
  });

  it("falls back to no space membership when the space cannot be resolved", async () => {
    const repo = fakeRepo();
    const provisioner = createWhatsAppPersonProvisioner({
      repo,
      spaceResolver: async () => undefined,
    });

    const result = await provisioner.handleInbound(msg());

    expect(result.person?.membershipSpaceIds).toEqual([]);
  });

  it("normalizes jid-suffixed senders", async () => {
    const repo = fakeRepo();
    const provisioner = createWhatsAppPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(
      msg({ sender: "16508665016@s.whatsapp.net" }),
    );

    expect(result.actor?.externalIdentities[0]?.value).toBe("16508665016");
  });

  it("skips empty senders", async () => {
    const repo = fakeRepo();
    const provisioner = createWhatsAppPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(msg({ sender: "" }));

    expect(result).toEqual({ actor: null, person: null, created: false });
  });
});