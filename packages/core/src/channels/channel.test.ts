import { describe, expect, it, vi } from "vitest";
import {
  createChannelRegistry,
  type ChannelAdapter,
  type ChannelKind,
  type InboundMessage,
} from "./channel.js";
import { createChannelService } from "./service.js";
import { createMemoryRepository } from "../repository/memory.js";

function fakeAdapter(id: string, kind: ChannelKind): ChannelAdapter {
  return {
    id,
    kind,
    async connect() {},
    async disconnect() {},
    async send() {},
    onMessage() {},
  };
}

describe("channel registry", () => {
  it("registers and retrieves adapters", () => {
    const registry = createChannelRegistry();
    const whatsapp = fakeAdapter("whatsapp", "whatsapp");
    registry.register(whatsapp);

    expect(registry.get("whatsapp")).toBe(whatsapp);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.list()).toEqual([whatsapp]);
  });

  it("lists adapters in insertion order", () => {
    const registry = createChannelRegistry();
    const a = fakeAdapter("a", "web");
    const b = fakeAdapter("b", "matrix");
    registry.register(a);
    registry.register(b);

    expect(registry.list()).toEqual([a, b]);
  });
});

describe("channel service", () => {
  it("publishes a message.received event for inbound messages", async () => {
    const publish = vi.fn(async (event: unknown) => event);
    const service = createChannelService({
      repo: createMemoryRepository(),
      eventBus: { publish },
    });

    const msg: InboundMessage = {
      channelId: "whatsapp",
      kind: "whatsapp",
      sender: "1234567890",
      text: "hello",
      timestamp: "2024-01-01T00:00:00.000Z",
    };

    await service.onInbound(msg);

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0] as {
      type: string;
      idempotencyKey: string;
      payload: Record<string, unknown>;
    };
    expect(event.type).toBe("message.received");
    expect(event.idempotencyKey).toBe(
      "whatsapp:1234567890:2024-01-01T00:00:00.000Z",
    );
    expect(event.payload).toMatchObject({
      channelId: "whatsapp",
      kind: "whatsapp",
      sender: "1234567890",
      text: "hello",
    });
  });

  it("connectChannel and disconnectChannel delegate to the registry", async () => {
    const connect = vi.fn(async () => {});
    const disconnect = vi.fn(async () => {});
    const registry = createChannelRegistry();
    registry.register({
      id: "whatsapp",
      kind: "whatsapp",
      connect,
      disconnect,
      send: vi.fn(async () => {}),
      onMessage: vi.fn(),
    });
    const service = createChannelService({
      repo: createMemoryRepository(),
      eventBus: { publish: vi.fn() },
      registry,
    });

    await service.connectChannel("whatsapp");
    await service.disconnectChannel("whatsapp");

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("throws when connecting an unknown channel", async () => {
    const service = createChannelService({
      repo: createMemoryRepository(),
      eventBus: { publish: vi.fn() },
    });

    await expect(service.connectChannel("nope")).rejects.toThrow(
      "unknown channel: nope",
    );
  });
});
