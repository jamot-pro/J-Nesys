import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelegramAdapter } from "./telegram.js";
import type { InboundMessage } from "./channel.js";

const sampleUpdate = {
  update_id: 100,
  message: {
    message_id: 1,
    from: { id: 555 },
    chat: { id: 777 },
    date: 1700000000,
    text: "hello bot",
  },
};

function applyUpdateOnce() {
  let used = false;
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("getUpdates")) {
      if (!used) {
        used = true;
        return {
          ok: true,
          json: async () => ({ result: [sampleUpdate] }),
        };
      }
      // Park the poll loop so it does not busy-spin; disconnect aborts it.
      return new Promise<never>(() => {});
    }
    if (u.includes("sendMessage")) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram adapter", () => {
  it("emits an InboundMessage of kind telegram for inbound updates", async () => {
    const fetchMock = applyUpdateOnce();
    const adapter = createTelegramAdapter({ token: "TEST_TOKEN" });
    const received: InboundMessage[] = [];
    adapter.onMessage((m) => received.push(m));

    await adapter.connect();
    // Let the poll loop tick and process the mocked update.
    await new Promise((r) => setTimeout(r, 20));
    await adapter.disconnect();

    expect(fetchMock).toHaveBeenCalled();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      channelId: "telegram",
      kind: "telegram",
      sender: "555",
      text: "hello bot",
      room: "777",
      timestamp: new Date(1700000000 * 1000).toISOString(),
    });
  });

  it("sends a message via the Bot API", async () => {
    const fetchMock = applyUpdateOnce();
    const adapter = createTelegramAdapter({
      token: "TEST_TOKEN",
      apiUrl: "https://example.test/botTEST_TOKEN",
    });
    adapter.onMessage(() => {});
    await adapter.connect();

    await adapter.send("777", "pong");

    const sendCall = fetchMock.mock.calls.find((c) =>
      String((c as unknown as [string])[0]).includes("sendMessage"),
    );
    expect(sendCall).toBeDefined();
    const init = (sendCall as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ chat_id: "777", text: "pong" });

    await adapter.disconnect();
  });

  it("throws when sending before connect", async () => {
    const adapter = createTelegramAdapter({ token: "TEST_TOKEN" });
    await expect(adapter.send("1", "x")).rejects.toThrow(
      "telegram adapter not connected",
    );
  });
});
