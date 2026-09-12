import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function setup() {
  const repository = createMemoryRepository();
  const app = await buildApp({ repository, secret: "test" });
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email: "holder@example.com", password: "password123", displayName: "Holder" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "holder@example.com", password: "password123" },
  });
  const cookie = sessionCookie(login);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  return { app, repository, cookie, ownerActorId: me.json().actor.id as string };
}

describe("discover", () => {
  it("lists only organizations that have written a dream", async () => {
    const { app, repository, ownerActorId } = await setup();
    const space = await repository.createSpace({ name: "Tidal Grid", kind: "organization", ownerActorId });
    await repository.createOrganization({ spaceId: space.id, dream: "Tidal power for every island." });
    const silent = await repository.createSpace({ name: "Quiet Co", kind: "organization", ownerActorId });
    await repository.createOrganization({ spaceId: silent.id, dream: "" });

    const res = await app.inject({ method: "GET", url: "/api/dreams" });
    expect(res.statusCode).toBe(200);
    const { items } = res.json();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Tidal Grid",
      statement: "Tidal power for every island.",
      believers: 0,
      agents: 0,
      joined: false,
    });
  });

  it("counts believers, and joining twice still counts one", async () => {
    const { app, repository, cookie, ownerActorId } = await setup();
    const space = await repository.createSpace({ name: "Open Seed Bank", kind: "organization", ownerActorId });
    const org = await repository.createOrganization({ spaceId: space.id, dream: "A seed library." });

    for (const _ of [0, 1]) {
      const joined = await app.inject({
        method: "POST",
        url: `/api/dreams/${org.id}/believers`,
        headers: { cookie },
      });
      expect(joined.statusCode).toBe(201);
    }

    const res = await app.inject({ method: "GET", url: "/api/dreams", headers: { cookie } });
    const dream = res.json().items.find((d: { organizationId: string }) => d.organizationId === org.id);
    expect(dream.believers).toBe(1);
    expect(dream.joined).toBe(true);

    const left = await app.inject({
      method: "DELETE",
      url: `/api/dreams/${org.id}/believers`,
      headers: { cookie },
    });
    expect(left.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/dreams", headers: { cookie } });
    const gone = after.json().items.find((d: { organizationId: string }) => d.organizationId === org.id);
    expect(gone.believers).toBe(0);
    expect(gone.joined).toBe(false);
  });

  it("refuses to join a dream nobody has written", async () => {
    const { app, repository, cookie, ownerActorId } = await setup();
    const space = await repository.createSpace({ name: "Blank", kind: "organization", ownerActorId });
    const org = await repository.createOrganization({ spaceId: space.id, dream: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/dreams/${org.id}/believers`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("requires a session to join", async () => {
    const { app, repository, ownerActorId } = await setup();
    const space = await repository.createSpace({ name: "Reknit", kind: "organization", ownerActorId });
    const org = await repository.createOrganization({ spaceId: space.id, dream: "Repair beats replace." });

    const res = await app.inject({ method: "POST", url: `/api/dreams/${org.id}/believers` });
    expect(res.statusCode).toBe(401);
  });

  it("serves the presentation fields a holder has set", async () => {
    const { app, repository, ownerActorId } = await setup();
    const space = await repository.createSpace({ name: "Lumen Schools", kind: "organization", ownerActorId });
    const org = await repository.createOrganization({ spaceId: space.id, dream: "A tutor agent per school." });
    await repository.upsertDreamListing(org.id, {
      holderName: "Diego Ferraz",
      place: "Porto",
      category: "Education",
      needs: ["Teachers", "Dialect speakers"],
      payBand: "€30–€150 / task",
      fundedPct: 78,
    });

    const res = await app.inject({ method: "GET", url: "/api/dreams" });
    const dream = res.json().items.find((d: { organizationId: string }) => d.organizationId === org.id);
    expect(dream).toMatchObject({
      holderName: "Diego Ferraz",
      place: "Porto",
      category: "Education",
      payBand: "€30–€150 / task",
      fundedPct: 78,
    });
    expect(dream.needs).toEqual(["Teachers", "Dialect speakers"]);
  });
});
