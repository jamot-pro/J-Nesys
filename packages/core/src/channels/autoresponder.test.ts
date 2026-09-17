import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../repository/memory.js";
import { resolveReplyAgent, draftAgentReply } from "./autoresponder.js";
import { createMockProvider } from "../llm/mock.js";

async function makeAgent(repo: ReturnType<typeof createMemoryRepository>, name: string) {
  const actor = await repo.createActor({
    type: "agent",
    source: "internal",
    displayName: name,
    externalIdentities: [],
  });
  return repo.createAgent({
    actorId: actor.id,
    ownerId: actor.id,
    harness: { kind: "generic_http", endpoint: null, config: {} },
  });
}

async function makeSpaceAndPerson(repo: ReturnType<typeof createMemoryRepository>) {
  const owner = await repo.createActor({
    type: "human",
    source: "internal",
    displayName: "Owner",
    externalIdentities: [],
  });
  const space = await repo.createSpace({ kind: "personal", ownerActorId: owner.id, name: "Owner" });
  const personActor = await repo.createActor({
    type: "human",
    source: "external",
    displayName: "Sender",
    externalIdentities: [],
  });
  const person = await repo.createPerson({
    actorId: personActor.id,
    membershipSpaceIds: [space.id],
  });
  return { space, person };
}

describe("resolveReplyAgent", () => {
  it("routes to the agent assigned to a list the sender belongs to", async () => {
    const repo = createMemoryRepository();
    const { space, person } = await makeSpaceAndPerson(repo);
    const agent = await makeAgent(repo, "Support Bot");

    const list = await repo.createPeopleList({ spaceId: space.id, name: "VIP customers" });
    await repo.setPeopleListReplyAgent(list.id, agent.id);
    await repo.addPeopleListMember(list.id, person.id);

    const resolved = await resolveReplyAgent(repo, {
      personId: person.id,
      spaceId: space.id,
      isNewPerson: false,
    });
    expect(resolved).toBe(agent.id);
  });

  it("returns null for a known person on a list with no agent assigned", async () => {
    const repo = createMemoryRepository();
    const { space, person } = await makeSpaceAndPerson(repo);
    const list = await repo.createPeopleList({ spaceId: space.id, name: "Unassigned" });
    await repo.addPeopleListMember(list.id, person.id);

    const resolved = await resolveReplyAgent(repo, {
      personId: person.id,
      spaceId: space.id,
      isNewPerson: false,
    });
    expect(resolved).toBeNull();
  });

  it("falls back to the space's default agent for a brand-new sender", async () => {
    const repo = createMemoryRepository();
    const { space, person } = await makeSpaceAndPerson(repo);
    const agent = await makeAgent(repo, "Front Desk");
    await repo.setSpaceSettings(space.id, { defaultReplyAgentId: agent.id });

    const resolved = await resolveReplyAgent(repo, {
      personId: person.id,
      spaceId: space.id,
      isNewPerson: true,
    });
    expect(resolved).toBe(agent.id);
  });

  it("gives no response to a new sender when no default agent is configured", async () => {
    const repo = createMemoryRepository();
    const { space, person } = await makeSpaceAndPerson(repo);

    const resolved = await resolveReplyAgent(repo, {
      personId: person.id,
      spaceId: space.id,
      isNewPerson: true,
    });
    expect(resolved).toBeNull();
  });
});

describe("draftAgentReply", () => {
  it("drafts a reply from the assigned agent for the sender's message", async () => {
    const repo = createMemoryRepository();
    const agent = await makeAgent(repo, "Support Bot");
    const llm = createMockProvider();

    const reply = await draftAgentReply(
      { repo, llm },
      { agentId: agent.id, personId: "someone", messageText: "I have a question about my order" },
    );
    expect(reply).toBeTruthy();
  });

  it("returns null when the agent no longer exists", async () => {
    const repo = createMemoryRepository();
    const llm = createMockProvider();

    const reply = await draftAgentReply(
      { repo, llm },
      { agentId: "missing-agent", personId: "someone", messageText: "hello" },
    );
    expect(reply).toBeNull();
  });
});
