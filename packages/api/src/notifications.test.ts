import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
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

describe("notifications", () => {
  it("lists only the authenticated actor's own notifications, and marking read persists", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const aliceCookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");
    const bobCookie = await registerAndLogin(app, "bob@example.com", "password123", "Bob");

    const aliceMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: aliceCookie } });
    const aliceActorId = aliceMe.json().actor.id;
    const bobMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: bobCookie } });
    const bobActorId = bobMe.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: aliceCookie },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    const spaceId = org.json().organization.spaceId;

    await repo.createNotification({
      spaceId,
      actorId: aliceActorId,
      type: "message",
      title: "You were assigned: Follow up",
      targetSection: "tasks",
    });
    await repo.createNotification({
      spaceId,
      actorId: bobActorId,
      type: "message",
      title: "Someone else's notification",
    });

    const aliceList = await app.inject({
      method: "GET",
      url: `/api/notifications?spaceId=${spaceId}`,
      headers: { cookie: aliceCookie },
    });
    expect(aliceList.statusCode).toBe(200);
    expect(aliceList.json().items).toHaveLength(1);
    const notification = aliceList.json().items[0];
    expect(notification.title).toBe("You were assigned: Follow up");
    expect(notification.read).toBe(false);

    // Bob can't mark Alice's notification read.
    const bobTriesToRead = await app.inject({
      method: "PUT",
      url: `/api/notifications/${notification.id}/read`,
      headers: { cookie: bobCookie },
    });
    expect(bobTriesToRead.statusCode).toBe(404);

    const aliceReads = await app.inject({
      method: "PUT",
      url: `/api/notifications/${notification.id}/read`,
      headers: { cookie: aliceCookie },
    });
    expect(aliceReads.statusCode).toBe(200);

    const aliceListAfter = await app.inject({
      method: "GET",
      url: `/api/notifications?spaceId=${spaceId}`,
      headers: { cookie: aliceCookie },
    });
    expect(aliceListAfter.json().items[0].read).toBe(true);
  });

  it("read-all marks every item for the actor read", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const cookie = await registerAndLogin(app, "carol@example.com", "password123", "Carol");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const actorId = me.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    const spaceId = org.json().organization.spaceId;

    await repo.createNotification({ spaceId, actorId, type: "completed", title: "First" });
    await repo.createNotification({ spaceId, actorId, type: "approval", title: "Second" });

    const readAll = await app.inject({
      method: "PUT",
      url: "/api/notifications/read-all",
      headers: { cookie },
    });
    expect(readAll.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: `/api/notifications?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(list.json().items.every((n: { read: boolean }) => n.read)).toBe(true);
  });
});
