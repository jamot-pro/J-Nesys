import { describe, expect, it, vi } from "vitest";
import type { Event } from "@jamot/contracts";
import { createEventBus } from "./event-bus.js";
import type { Db } from "../db.js";
import type { NewEvent } from "./event-bus.js";

const SPACE = "00000000-0000-4000-8000-000000000001";
const ACTOR = "00000000-0000-4000-8000-000000000002";

function event(overrides: Partial<NewEvent> = {}): NewEvent {
  return {
    type: "task.created",
    idempotencyKey: "key-1",
    spaceId: SPACE,
    actorId: ACTOR,
    payload: { title: "ship the kernel" },
    ...overrides,
  };
}

describe("event bus (in-memory)", () => {
  it("publishes to subscribers with the parsed event", async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    const published = await bus.publish(event());

    expect(handler).toHaveBeenCalledTimes(1);
    const received = handler.mock.calls[0]?.[0] as Event;
    expect(received.type).toBe("task.created");
    expect(received.payload).toEqual({ title: "ship the kernel" });
    expect(received.idempotencyKey).toBe("key-1");
    expect(received.spaceId).toBe(SPACE);
    expect(published.id).toBe(received.id);
  });

  it("filters subscribers by event type", async () => {
    const bus = createEventBus();
    const taskHandler = vi.fn();
    const messageHandler = vi.fn();

    bus.subscribe("task.created", taskHandler);
    bus.subscribe("message.received", messageHandler);

    await bus.publish(event({ type: "task.created" }));

    expect(taskHandler).toHaveBeenCalledTimes(1);
    expect(messageHandler).not.toHaveBeenCalled();
  });

  it("supports unsubscribe via the returned function", async () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(handler);

    await bus.publish(event({ idempotencyKey: "a" }));
    unsubscribe();
    await bus.publish(event({ idempotencyKey: "b" }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports clearing all subscribers via unsubscribe()", async () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe(first);
    bus.subscribe(second);
    bus.unsubscribe();

    await bus.publish(event());

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(bus.handlers()).toHaveLength(0);
  });

  it("tracks registered handlers", () => {
    const bus = createEventBus();
    expect(bus.handlers()).toHaveLength(0);
    bus.subscribe(vi.fn());
    bus.subscribe("message.received", vi.fn());
    expect(bus.handlers()).toHaveLength(2);
  });

  it("does not crash when a subscriber throws", async () => {
    const bus = createEventBus();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    bus.subscribe(throwing);
    bus.subscribe(healthy);

    await expect(bus.publish(event())).resolves.toBeTruthy();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});

describe("event bus (outbox idempotency)", () => {
  function extractKey(cond: unknown): string {
    const chunks = (cond as { queryChunks?: Array<{ value?: unknown }> })
      .queryChunks;
    for (const chunk of chunks ?? []) {
      if (typeof chunk?.value === "string") return chunk.value;
    }
    return "";
  }

  function fakeDb() {
    const seen = new Set<string>();
    const db = {
      select: () => ({
        from: () => ({
          where: (cond: unknown) => ({
            limit: async () =>
              seen.has(extractKey(cond)) ? [{ id: "existing" }] : [],
          }),
        }),
      }),
      insert: () => ({
        values: async (row: { idempotencyKey: string }) => {
          seen.add(row.idempotencyKey);
        },
      }),
    };
    return { db } as unknown as Db;
  }

  it("dedupes repeated idempotency keys", async () => {
    const bus = createEventBus(fakeDb());
    const handler = vi.fn();
    bus.subscribe(handler);

    await bus.publish(event({ idempotencyKey: "dup" }));
    await bus.publish(event({ idempotencyKey: "dup" }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("delivers once per unique idempotency key", async () => {
    const bus = createEventBus(fakeDb());
    const handler = vi.fn();
    bus.subscribe(handler);

    await bus.publish(event({ idempotencyKey: "one" }));
    await bus.publish(event({ idempotencyKey: "two" }));

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
