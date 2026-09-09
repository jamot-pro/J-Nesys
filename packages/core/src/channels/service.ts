import type { JamotRepository } from "../repository/repository.js";
import {
  createChannelRegistry,
  type ChannelAdapter,
  type ChannelRegistry,
  type InboundMessage,
} from "./channel.js";

export interface ChannelEventBus {
  publish(event: unknown): Promise<unknown>;
}

export interface ChannelServiceDeps {
  repo: JamotRepository;
  eventBus: ChannelEventBus;
  registry?: ChannelRegistry;
}

export interface ChannelService {
  onInbound(msg: InboundMessage): Promise<unknown>;
  listChannels(): ChannelAdapter[];
  connectChannel(id: string): Promise<void>;
  disconnectChannel(id: string): Promise<void>;
}

export function createChannelService(deps: ChannelServiceDeps): ChannelService {
  const { eventBus, registry = createChannelRegistry() } = deps;

  return {
    onInbound(msg) {
      return eventBus.publish({
        type: "message.received",
        spaceId: msg.spaceId ?? null,
        actorId: null,
        idempotencyKey: `${msg.kind}:${msg.sender}:${msg.timestamp}`,
        payload: {
          channelId: msg.channelId,
          kind: msg.kind,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          room: msg.room,
          raw: msg.raw,
        },
      });
    },

    listChannels() {
      return registry.list();
    },

    async connectChannel(id) {
      const adapter = registry.get(id);
      if (!adapter) throw new Error(`unknown channel: ${id}`);
      await adapter.connect();
    },

    async disconnectChannel(id) {
      const adapter = registry.get(id);
      if (!adapter) throw new Error(`unknown channel: ${id}`);
      await adapter.disconnect();
    },
  };
}
