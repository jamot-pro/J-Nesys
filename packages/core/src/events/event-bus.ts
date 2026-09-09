import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Event, EventType } from "@jamot/contracts";
import { events } from "../schema/index.js";
import type { Db } from "../db.js";

export type EventHandler = (event: Event) => void | Promise<void>;

export type Subscriber = {
  type: EventType | null;
  handler: EventHandler;
};

export type NewEvent = {
  type: EventType;
  id?: string;
  spaceId?: string | null;
  actorId?: string | null;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
  delivered?: boolean;
};

export type EventPublisher = {
  publish(event: NewEvent): Promise<Event>;
  subscribe(typeOrHandler: EventType | EventHandler, handler?: EventHandler): () => void;
  unsubscribe(): void;
  handlers(): readonly Subscriber[];
};

function buildEvent(input: NewEvent): Event {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return {
    id: input.id ?? randomUUID(),
    type: input.type,
    spaceId: input.spaceId ?? null,
    actorId: input.actorId ?? null,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload ?? {},
    occurredAt,
    delivered: input.delivered ?? false,
  } as Event;
}

export function createEventBus(db?: Db): EventPublisher {
  const subscribers = new Set<Subscriber>();

  async function alreadyDelivered(idempotencyKey: string): Promise<boolean> {
    if (!db) return false;
    const existing = await db.db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.idempotencyKey, idempotencyKey))
      .limit(1);
    return existing.length > 0;
  }

  async function writeOutbox(event: Event): Promise<void> {
    if (!db) return;
    await db.db.insert(events).values({
      id: event.id,
      type: event.type,
      spaceId: event.spaceId,
      actorId: event.actorId,
      idempotencyKey: event.idempotencyKey,
      payload: event.payload,
      occurredAt: event.occurredAt,
      delivered: event.delivered,
    });
  }

  function deliver(event: Event): void {
    for (const subscriber of subscribers) {
      if (subscriber.type !== null && subscriber.type !== event.type) {
        continue;
      }
      try {
        subscriber.handler(event);
      } catch {
        // a misbehaving subscriber must not break delivery to the rest
      }
    }
  }

  return {
    async publish(input: NewEvent): Promise<Event> {
      const event = buildEvent(input);
      if (await alreadyDelivered(event.idempotencyKey)) {
        return event;
      }
      await writeOutbox(event);
      deliver(event);
      return event;
    },
    subscribe(typeOrHandler, handler) {
      let subscriber: Subscriber;
      if (typeof typeOrHandler === "function") {
        subscriber = { type: null, handler: typeOrHandler };
      } else {
        if (!handler) {
          throw new Error("handler is required when subscribing by event type");
        }
        subscriber = { type: typeOrHandler, handler };
      }
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    unsubscribe() {
      subscribers.clear();
    },
    handlers() {
      return [...subscribers];
    },
  };
}
