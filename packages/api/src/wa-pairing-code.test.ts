import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { WhatsAppAdapter, WhatsAppManager } from "@jamot/core/channels";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

/** A stand-in adapter: real WhatsAppManager wraps a live Baileys socket,
 * which no unit test can drive — this exercises the route's own logic
 * (validation, wiring, error surfacing), not the handshake itself. */
function fakeAdapter(behavior: {
  requestPairingCode?: (phone: string) => Promise<string>;
}): WhatsAppAdapter {
  return {
    id: "acc",
    kind: "whatsapp",
    async connect() {},
    async disconnect() {},
    async send() {},
    onMessage() {},
    getState() {
      return { connection: "connecting" };
    },
    async resetSession() {},
    requestPairingCode:
      behavior.requestPairingCode ?? (async () => "ABCD-1234"),
    async importSession() {},
    listChats() {
      return [];
    },
    listContacts() {
      return [];
    },
    getMessages() {
      return [];
    },
    searchMessages() {
      return [];
    },
    async sendText() {},
    async sendMedia() {},
    async markRead() {},
  };
}

function fakeManager(adapter: WhatsAppAdapter | undefined): WhatsAppManager {
  return {
    ensure: () => adapter ?? fakeAdapter({}),
    get: () => adapter,
    list: () => (adapter ? [adapter] : []),
    async remove() {},
    async close() {},
  };
}

async function setup(whatsAppManager?: WhatsAppManager) {
  const app = await buildApp({
    repository: createMemoryRepository(),
    secret: "test",
    whatsAppManager,
  });
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email: "wa@example.com", password: "password123", displayName: "Wa Owner" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "wa@example.com", password: "password123" },
  });
  const cookie = sessionCookie(login);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  const spaceId = me.json().person.membershipSpaceIds[0] as string;

  const created = await app.inject({
    method: "POST",
    url: "/api/wa/accounts",
    headers: { cookie },
    payload: { spaceId, label: "Main" },
  });
  return { app, cookie, accountId: created.json().id as string };
}

describe("WhatsApp pairing code", () => {
  it("requests a code from the adapter and returns it", async () => {
    let requestedWith: string | null = null;
    const adapter = fakeAdapter({
      requestPairingCode: async (phone) => {
        requestedWith = phone;
        return "WXYZ-9876";
      },
    });
    const { app, cookie, accountId } = await setup(fakeManager(adapter));

    const res = await app.inject({
      method: "POST",
      url: `/api/wa/accounts/${accountId}/pairing-code`,
      headers: { cookie },
      payload: { phoneNumber: "+1 555 0100" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toBe("WXYZ-9876");
    expect(requestedWith).toBe("+1 555 0100");
  });

  it("surfaces the adapter's own error as a 400", async () => {
    const adapter = fakeAdapter({
      requestPairingCode: async () => {
        throw new Error("not connected yet — wait a moment and try again");
      },
    });
    const { app, cookie, accountId } = await setup(fakeManager(adapter));

    const res = await app.inject({
      method: "POST",
      url: `/api/wa/accounts/${accountId}/pairing-code`,
      headers: { cookie },
      payload: { phoneNumber: "15550100" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("not connected yet");
  });

  it("returns 503 when no WhatsApp manager is configured", async () => {
    const { app, cookie, accountId } = await setup(undefined);

    const res = await app.inject({
      method: "POST",
      url: `/api/wa/accounts/${accountId}/pairing-code`,
      headers: { cookie },
      payload: { phoneNumber: "15550100" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 404 for an unknown account", async () => {
    const { app, cookie } = await setup(fakeManager(fakeAdapter({})));

    const res = await app.inject({
      method: "POST",
      url: "/api/wa/accounts/00000000-0000-4000-8000-000000000000/pairing-code",
      headers: { cookie },
      payload: { phoneNumber: "15550100" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a missing phone number before touching the adapter", async () => {
    const { app, cookie, accountId } = await setup(fakeManager(fakeAdapter({})));

    const res = await app.inject({
      method: "POST",
      url: `/api/wa/accounts/${accountId}/pairing-code`,
      headers: { cookie },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
