import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "./memory.js";
import type { Id } from "@jamot/contracts";

const UUID = "00000000-0000-4000-8000-000000000001";

function provenance() {
  const ts = new Date().toISOString();
  return { source: "self_declared" as const, confidence: 0.8, createdAt: ts, updatedAt: ts };
}

describe("memory repository", () => {
  it("CRUDs connectors", async () => {
    const repo = createMemoryRepository();

    const created = await repo.createConnector({
      provider: "github",
      type: "data",
      ownerActorId: UUID,
      credentialRef: { ref: "gh-pat", scope: "system" },
    });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(created.status).toBe("disconnected");
    expect(created.credentialRef).toEqual({ ref: "gh-pat", scope: "system" });

    const fetched = await repo.getConnector(created.id);
    expect(fetched).toEqual(created);

    const listed = await repo.listConnectors();
    expect(listed).toHaveLength(1);
    expect(await repo.listConnectors({ ownerOrganizationId: UUID })).toHaveLength(0);

    const updated = await repo.updateConnectorStatus(created.id, "connected");
    expect(updated?.status).toBe("connected");
    expect(await repo.getConnector(created.id)).toEqual(updated);
  });

  it("CRUDs capabilities with a space filter", async () => {
    const repo = createMemoryRepository();
    const spaceId = UUID;

    const created = await repo.createCapability({
      name: "customer.whatsapp.reply",
      skillId: UUID,
      connectorId: UUID,
      spaceId,
    });

    expect(created.name).toBe("customer.whatsapp.reply");
    expect(created.policyIds).toEqual([]);

    expect(await repo.getCapability(created.id)).toEqual(created);
    expect(await repo.listCapabilities({ spaceId })).toHaveLength(1);
    expect(await repo.listCapabilities()).toHaveLength(1);
    expect(await repo.listCapabilities({ spaceId: "00000000-0000-4000-8000-0000000000ff" })).toHaveLength(0);
  });

  it("CRUDs skills with provenance", async () => {
    const repo = createMemoryRepository();

    const created = await repo.createSkill({
      ownerActorId: UUID,
      name: "summarize",
      description: "summarize a document",
      provenance: provenance(),
    });

    expect(created.name).toBe("summarize");
    expect(created.status).toBe("draft");
    expect(created.provenance.source).toBe("self_declared");
    expect(created.prerequisites).toEqual([]);

    expect(await repo.getSkill(created.id)).toEqual(created);
    expect(await repo.listSkills()).toHaveLength(1);
    expect(await repo.listSkills({ ownerOrganizationId: UUID })).toHaveLength(0);
  });

  it("CRUDs policies with defaults", async () => {
    const repo = createMemoryRepository();
    const spaceId = UUID;

    const created = await repo.createPolicy({
      spaceId,
      name: "deny-external-writes",
      capability: "customer.*",
      decision: "deny",
    });

    expect(created.resource).toBe("*");
    expect(created.minRole).toBeNull();
    expect(created.riskThreshold).toBe(0.5);
    expect(created.decision).toBe("deny");

    expect(await repo.listPolicies({ spaceId })).toEqual([created]);
    expect(await repo.listPolicies()).toEqual([created]);
    expect(await repo.listPolicies({ spaceId: "00000000-0000-4000-8000-0000000000ff" })).toEqual([]);
  });

  it("stores and removes secrets by ref", async () => {
    const repo = createMemoryRepository();

    await repo.putSecret({
      ref: "stripe-key",
      scope: "organization",
      ownerOrganizationId: UUID,
      ciphertext: "cipher",
    });

    const secret = await repo.getSecret("stripe-key");
    expect(secret?.ciphertext).toBe("cipher");
    expect(secret?.scope).toBe("organization");

    await repo.deleteSecret("stripe-key");
    expect(await repo.getSecret("stripe-key")).toBeNull();
  });

  it("creates, updates and deletes agents with config fields", async () => {
    const repo = createMemoryRepository();
    const actor = await repo.createActor({ type: "agent", source: "internal", displayName: "Maria" });

    const created = await repo.createAgent({
      actorId: actor.id,
      ownerId: actor.id,
      harness: { kind: "mcp", endpoint: null, config: {} },
      role: "Sales Assistant",
      purpose: "Help the sales team convert conversations into opportunities.",
      skillIds: [UUID],
      heartbeat: { enabled: true, cron: "*/15 * * * *", quietHours: "22:00-07:00", check: ["assigned_tasks", "new_messages"], onAction: "ask" },
    });

    expect(created.purpose).toContain("sales");
    expect(created.heartbeat.check).toEqual(["assigned_tasks", "new_messages"]);
    expect(created.heartbeat.onAction).toBe("ask");
    expect(created.memoryScopes).toEqual([]);

    const updated = await repo.updateAgent(created.id, {
      autonomy: "autonomous",
      memoryScopes: ["organization", "department"],
      subscribedEvents: ["task.assigned", "message.received"],
      schedules: [{ id: UUID as Id, enabled: true, cron: "0 8 * * *", prompt: "Prepare today's briefing" }],
      actionPermissions: { send_message: "approval", delete_records: "never" },
    });
    expect(updated?.autonomy).toBe("autonomous");
    expect(updated?.memoryScopes).toContain("department");
    expect(updated?.schedules[0]?.prompt).toContain("briefing");
    expect(updated?.actionPermissions).toEqual({ send_message: "approval", delete_records: "never" });

    expect(await repo.getAgent(created.id)).toEqual(updated);

    await repo.deleteAgent(created.id);
    expect(await repo.getAgent(created.id)).toBeNull();
  });

  it("manages actor relationships", async () => {
    const repo = createMemoryRepository();
    const fromActor = await repo.createActor({ type: "agent", source: "internal", displayName: "Maria" });
    const toActor = await repo.createActor({ type: "human", source: "internal", displayName: "Andrea" });

    const rel = await repo.createRelationship({
      fromActorId: fromActor.id,
      toActorId: toActor.id,
      kind: "reports_to",
    });
    expect(rel.kind).toBe("reports_to");

    const listed = await repo.listRelationshipsForActor(fromActor.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.toActorId).toBe(toActor.id);

    const listedBoth = await repo.listRelationshipsForActor(toActor.id);
    expect(listedBoth).toHaveLength(1);

    await repo.deleteRelationship(rel.id);
    expect(await repo.listRelationshipsForActor(fromActor.id)).toHaveLength(0);
  });

  it("records and lists events filtered by actor", async () => {
    const repo = createMemoryRepository();
    const actor = await repo.createActor({ type: "agent", source: "internal", displayName: "Maria" });

    await repo.recordEvent({ type: "agent.created", actorId: actor.id, payload: { agentId: "x" } });
    await repo.recordEvent({ type: "memory.created", actorId: actor.id });
    await repo.recordEvent({ type: "task.created", actorId: "00000000-0000-4000-8000-0000000000aa" });

    const mine = await repo.listEvents({ actorId: actor.id });
    expect(mine).toHaveLength(2);
    expect(mine.map((e) => e.type).sort()).toEqual(["agent.created", "memory.created"]);

    const limited = await repo.listEvents({ actorId: actor.id, limit: 1 });
    expect(limited).toHaveLength(1);
  });
});
