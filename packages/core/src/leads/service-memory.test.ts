import { describe, expect, it } from "vitest";
import { createLeadGenerationService } from "./service.js";
import { createLeadProviderRegistry } from "./registry.js";
import type { LeadProvider } from "./types.js";
import { createMemoryRepository } from "../repository/memory.js";
import { createInMemoryMemoryProvider } from "../memory/memory-in-memory.js";
import { createSecretStore } from "../secrets/secret-store.js";
import type { Id, RawLead } from "@jamot/contracts";

const SPACE_ID = "00000000-0000-4000-8000-0000000000aa" as Id;

function fakeProvider(leads: RawLead[]): LeadProvider {
  return {
    id: "fake",
    label: "Fake",
    kind: "api",
    async configured() {
      return true;
    },
    async describe() {
      return "fake";
    },
    async search() {
      return leads;
    },
    async enrich(lead) {
      return { ...lead, title: "Enriched Title" };
    },
  };
}

function rawLead(email: string): RawLead {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email,
    phone: null,
    title: "",
    seniority: "",
    company: "Acme",
    industry: "",
    companySize: "",
    location: "",
    hqLocation: "",
    linkedinUrl: null,
    website: null,
    extra: {},
    raw: { source: "fake" },
  };
}

async function setup(leads: RawLead[]) {
  const repo = createMemoryRepository();
  const memory = createInMemoryMemoryProvider();
  const secretStore = createSecretStore({ encryptionKey: Buffer.alloc(32).toString("base64") });
  const services = { repo, secretStore, memory };
  const registry = createLeadProviderRegistry(services, [fakeProvider(leads)]);
  const service = createLeadGenerationService(repo, registry, services);

  const list = await service.createList(
    {
      spaceId: SPACE_ID,
      name: "Test list",
      providerId: "fake",
    },
    null,
  );
  return { repo, memory, service, list };
}

describe("lead generation memory writes", () => {
  it("records a 'captured' memory entry for a newly created lead person", async () => {
    const { memory, service, list } = await setup([rawLead("ada@example.com")]);

    const result = await service.runList(list.id);
    expect(result.added).toBe(1);

    const members = await service.listLeads(list.id);
    const personId = members[0]!.personId;

    const entries = await memory.list({ scope: "person", ownerId: personId });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.content).toMatchObject({
      channel: "lead-gen",
      event: "captured",
      listName: "Test list",
    });
    expect(entries[0]?.provenance.source).toBe("system");
  });

  it("records an 'enriched' memory entry when enrichLead runs", async () => {
    const { memory, service, list } = await setup([rawLead("ada2@example.com")]);
    await service.runList(list.id);
    const members = await service.listLeads(list.id);
    const personId = members[0]!.personId;

    await service.enrichLead(list.id, personId);

    const entries = await memory.list({ scope: "person", ownerId: personId });
    const events = entries.map((e) => (e.content as { event?: string }).event);
    expect(events).toContain("captured");
    expect(events).toContain("enriched");
  });

  it("re-running the same list against an existing person records another 'enriched' entry, not a duplicate person", async () => {
    const { memory, service, list } = await setup([rawLead("ada3@example.com")]);
    await service.runList(list.id);
    const first = await service.listLeads(list.id);
    expect(first).toHaveLength(1);

    const second = await service.runList(list.id);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(1);

    const personId = first[0]!.personId;
    const entries = await memory.list({ scope: "person", ownerId: personId });
    const events = entries.map((e) => (e.content as { event?: string }).event);
    expect(events).toEqual(["captured", "enriched"]);
  });
});
