import { describe, expect, it, beforeAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function makeApp() {
  return buildApp({ repository: createMemoryRepository(), secret: "test" });
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email, password, displayName },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return sessionCookie(login);
}

describe("Vibe DREAM org graph", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let owner: string;
  let member: string;
  let orgId: string;

  beforeAll(async () => {
    app = await makeApp();
    owner = await registerAndLogin(app, "dream-owner@example.com", "password123", "Owner");
    const created = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Dream Co", dream: "sell dreams" },
    });
    expect(created.statusCode).toBe(201);
    orgId = created.json().organization.id;

    member = await registerAndLogin(app, "dream-member@example.com", "password123", "Member");
    await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "dream-member@example.com", role: "member" },
    });
  });

  it("auto-creates a DREAM node on first graph read", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/graph`,
      headers: { cookie: owner },
    });
    expect(res.statusCode).toBe(200);
    const nodes = res.json().nodes;
    const dream = nodes.find((n: any) => n.kind === "dream");
    expect(dream).toBeTruthy();
    expect(dream.config.objective).toBe("sell dreams");
  });

  it("creates team, agent, responsibility, heartbeat and tool nodes", async () => {
    const team = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/nodes`,
      headers: { cookie: owner },
      payload: { kind: "team", name: "Core", config: { mission: "Do it" } },
    });
    expect(team.statusCode).toBe(201);
    const teamId = team.json().id;

    const agent = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/nodes`,
      headers: { cookie: owner },
      payload: { kind: "agent", name: "Ops Agent" },
    });
    expect(agent.statusCode).toBe(201);
    const agentId = agent.json().id;

    const resp = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/nodes`,
      headers: { cookie: owner },
      payload: { kind: "responsibility", name: "Delivery" },
    });
    expect(resp.statusCode).toBe(201);
    const respId = resp.json().id;

    const hb = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/nodes`,
      headers: { cookie: owner },
      payload: {
        kind: "heartbeat",
        name: "Pulse",
        config: { schedule: "0 9 * * 1", actions: ["escalate"], enabled: true },
      },
    });
    expect(hb.statusCode).toBe(201);
    const hbId = hb.json().id;

    const tool = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/nodes`,
      headers: { cookie: owner },
      payload: { kind: "tool", name: "CRM" },
    });
    expect(tool.statusCode).toBe(201);
    const toolId = tool.json().id;

    // Connect: agent member of team; agent responsible for delivery; hb monitors team.
    const memberEdge = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/edges`,
      headers: { cookie: owner },
      payload: { fromNodeId: agentId, toNodeId: teamId, relation: "member_of" },
    });
    expect(memberEdge.statusCode).toBe(201);

    const ownerEdge = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/edges`,
      headers: { cookie: owner },
      payload: { fromNodeId: agentId, toNodeId: respId, relation: "responsible_for" },
    });
    expect(ownerEdge.statusCode).toBe(201);

    const monitorEdge = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/edges`,
      headers: { cookie: owner },
      payload: { fromNodeId: hbId, toNodeId: teamId, relation: "monitors" },
    });
    expect(monitorEdge.statusCode).toBe(201);

    const edgeFromStanger = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/edges`,
      headers: { cookie: owner },
      payload: { fromNodeId: agentId, toNodeId: toolId, relation: "uses" },
    });
    expect(edgeFromStanger.statusCode).toBe(201);

    const graph = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/graph`,
      headers: { cookie: owner },
    });
    expect(graph.json().edges.length).toBe(4);
  });

  it("rejects an edge whose endpoint is in another org", async () => {
    const other = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Other Co" },
    });
    const otherId = other.json().organization.id;
    const foreign = await app.inject({
      method: "POST",
      url: `/api/organizations/${otherId}/graph/nodes`,
      headers: { cookie: owner },
      payload: { kind: "tool", name: "Foreign" },
    });
    const foreignId = foreign.json().id;
    const own = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/graph`,
      headers: { cookie: owner },
    });
    const ownDream = own.json().nodes.find((n: any) => n.kind === "dream");

    const bad = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/graph/edges`,
      headers: { cookie: owner },
      payload: { fromNodeId: ownDream.id, toNodeId: foreignId, relation: "owns" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("computes readiness and exposes JAMOT", async () => {
    const readiness = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/readiness`,
      headers: { cookie: owner },
    });
    expect(readiness.statusCode).toBe(200);
    const report = readiness.json();
    expect(report.dimensions.length).toBe(10);
    expect(typeof report.overall).toBe("number");
    expect(typeof report.jamot).toBe("boolean");

    const jamot = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/jamot`,
      headers: { cookie: owner },
    });
    expect(jamot.statusCode).toBe(200);
    expect(typeof jamot.json().jamot).toBe("boolean");
  });

  it("sets the DREAM config (admin only) and records it on the dream node", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/dream`,
      headers: { cookie: owner },
      payload: {
        objective: "€1M ARR AI consulting company",
        outcomes: ["Repeatable delivery"],
        kpis: [{ name: "ARR", target: "€1M", unit: "EUR" }],
        constraints: [],
        timeline: [],
        requiredCapabilities: ["consulting"],
        requiredResponsibilities: ["Sales", "Delivery"],
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().dream.objective).toBe("€1M ARR AI consulting company");

    const byMember = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/dream`,
      headers: { cookie: member },
      payload: { objective: "nope" },
    });
    expect(byMember.statusCode).toBe(403);
  });

  it("member can read the graph but cannot delete nodes", async () => {
    const graph = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/graph`,
      headers: { cookie: member },
    });
    expect(graph.statusCode).toBe(200);

    const first = graph.json().nodes[0];
    const del = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}/graph/nodes/${first.id}`,
      headers: { cookie: member },
    });
    expect(del.statusCode).toBe(403);
  });

  it("stranger cannot access the org graph", async () => {
    const eve = await registerAndLogin(app, "dream-eve@example.com", "password123", "Eve");
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/graph`,
      headers: { cookie: eve },
    });
    expect(res.statusCode).toBe(403);
  });
});