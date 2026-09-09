import { describe, expect, it } from "vitest";
import type { Id } from "@jamot/contracts";
import type { InboundMessage } from "../channels/channel.js";
import { createChannelPersonProvisioner } from "./channel-person.js";
import { createMemoryRepository } from "../repository/memory.js";

const SPACE = "00000000-0000-4000-8000-000000000001" as Id;

function msg(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channelId: "acct-1",
    kind: "telegram",
    sender: "424242",
    text: "hi",
    timestamp: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("channel person provisioner (identity resolution)", () => {
  it("creates a person with telegram name from the update payload", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({
      repo,
      spaceResolver: async () => SPACE,
    });

    const result = await provisioner.handleInbound(
      msg({ raw: { from: { id: 424242, first_name: "Andrea", last_name: "Rossi" } } }),
    );

    expect(result.created).toBe(true);
    expect(result.actor?.displayName).toBe("Andrea Rossi");
    expect(result.person?.firstName).toBe("Andrea");
    expect(result.person?.lastName).toBe("Rossi");
    expect(result.person?.membershipSpaceIds).toEqual([SPACE]);

    const identities = await repo.listIdentitiesForPerson(result.person!.id);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ provider: "telegram", value: "424242" });
  });

  it("reuses the person on repeat messages and updates last interaction", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({ repo });

    const first = await provisioner.handleInbound(msg());
    const second = await provisioner.handleInbound(
      msg({ timestamp: "2026-08-22T09:00:00.000Z" }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.person?.id).toBe(first.person?.id);
    expect(second.person?.lastInteractionAt).toBe("2026-08-22T09:00:00.000Z");

    const people = await repo.listPeople();
    expect(people).toHaveLength(1);
  });

  it("never fabricates a name when the source provides none", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(msg({ raw: undefined }));

    expect(result.actor?.displayName).toBe("424242");
    expect(result.person?.firstName).toBeNull();
    expect(result.person?.lastName).toBeNull();
  });

  it("stores the phone for whatsapp senders", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({ repo });

    const result = await provisioner.handleInbound(
      msg({ kind: "whatsapp", sender: "+39 333 1234567", raw: { pushName: "Andrea" } }),
    );

    expect(result.person?.phone).toBe("393331234567");
    expect(result.person?.firstName).toBe("Andrea");
  });

  it("reuses the person for the same channel identity across accounts", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({ repo });

    await provisioner.handleInbound(
      msg({ kind: "whatsapp", sender: "+39 333 1234567", channelId: "acct-1" }),
    );
    const second = await provisioner.handleInbound(
      msg({ kind: "whatsapp", sender: "+39 333 1234567", channelId: "acct-2" }),
    );

    // Exact identity match: same whatsapp number is the SAME identity, so it
    // must reuse the person rather than create a duplicate or a merge case.
    expect(second.created).toBe(false);
    const candidates = await repo.listMergeCandidates();
    expect(candidates).toHaveLength(0);
  });

  it("flags a merge candidate when a new person collides on phone", async () => {
    const repo = createMemoryRepository();

    // A person already known with this phone (e.g. added manually).
    const existingActor = await repo.createActor({
      type: "human",
      source: "internal",
      displayName: "Andrea Rossi",
    });
    await repo.createPerson({
      actorId: existingActor.id,
      phone: "393331234567",
      membershipSpaceIds: [SPACE],
    });

    const provisioner = createChannelPersonProvisioner({ repo });
    const result = await provisioner.handleInbound(
      msg({ kind: "whatsapp", sender: "+39 333 1234567" }),
    );

    // The whatsapp identity is new, so a new person is created — but the
    // phone collision is flagged for human review instead of auto-merging.
    expect(result.created).toBe(true);
    const candidates = await repo.listMergeCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.personBId).toBe(result.person!.id);
    expect(candidates[0]!.reason).toContain("phone");
    const people = await repo.listPeople();
    expect(people).toHaveLength(2);
  });

  it("creates an email person and links the email identity", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({
      repo,
      providerOf: () => "email",
    });

    const result = await provisioner.handleInbound(
      msg({ kind: "web", sender: "Andrea@Example.com", raw: undefined }),
    );

    expect(result.person?.email).toBe("andrea@example.com");
    const identities = await repo.listIdentitiesForPerson(result.person!.id);
    expect(identities[0]).toMatchObject({ provider: "email", value: "Andrea@Example.com" });
  });

  it("records person.created events", async () => {
    const repo = createMemoryRepository();
    const provisioner = createChannelPersonProvisioner({ repo });

    await provisioner.handleInbound(msg());

    const events = await repo.listEvents();
    expect(events.some((e) => e.type === "person.created")).toBe(true);
  });
});
