export type ChannelKind = "whatsapp" | "matrix" | "telegram" | "discord" | "web";

export interface InboundMessage {
  channelId: string;
  kind: ChannelKind;
  sender: string;
  text: string;
  timestamp: string;
  room?: string;
  spaceId?: string;
  raw?: unknown;
}

export interface ChannelAdapter {
  id: string;
  kind: ChannelKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(recipient: string, text: string): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => void): void;
}

export interface ChannelRegistry {
  register(adapter: ChannelAdapter): void;
  get(id: string): ChannelAdapter | undefined;
  list(): ChannelAdapter[];
}

export function createChannelRegistry(): ChannelRegistry {
  const adapters = new Map<string, ChannelAdapter>();

  return {
    register(adapter) {
      adapters.set(adapter.id, adapter);
    },
    get(id) {
      return adapters.get(id);
    },
    list() {
      return [...adapters.values()];
    },
  };
}
