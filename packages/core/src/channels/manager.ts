import { join, normalize, sep } from "node:path";
import type { InboundMessage } from "./channel.js";
import {
  createWhatsAppAdapter,
  type WhatsAppAdapter,
} from "./whatsapp.js";

export interface WhatsAppManagerOpts {
  sessionBaseDir: string;
  onMessage?: (msg: InboundMessage) => void;
  proxyUrl?: string;
}

export interface WhatsAppManager {
  ensure(accountId: string, label?: string): WhatsAppAdapter;
  get(accountId: string): WhatsAppAdapter | undefined;
  list(): WhatsAppAdapter[];
  remove(accountId: string): Promise<void>;
  close(): Promise<void>;
}

function sessionDirFor(base: string, accountId: string): string {
  const root = normalize(base);
  const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = normalize(join(root, safe));
  if (!dir.startsWith(root + sep)) throw new Error("invalid account id");
  return dir;
}

export function createWhatsAppManager(
  opts: WhatsAppManagerOpts,
): WhatsAppManager {
  const adapters = new Map<string, WhatsAppAdapter>();

  const onMessage = opts.onMessage ?? (() => {});

  return {
    ensure(accountId, label) {
      let adapter = adapters.get(accountId);
      if (adapter) return adapter;
      adapter = createWhatsAppAdapter({
        id: accountId,
        sessionDir: sessionDirFor(opts.sessionBaseDir, accountId),
        proxyUrl: opts.proxyUrl,
      });
      adapter.onMessage(onMessage);
      adapters.set(accountId, adapter);
      void adapter.connect();
      return adapter;
    },

    get(accountId) {
      return adapters.get(accountId);
    },

    list() {
      return [...adapters.values()];
    },

    async remove(accountId) {
      const adapter = adapters.get(accountId);
      if (!adapter) return;
      adapters.delete(accountId);
      await adapter.disconnect();
    },

    async close() {
      await Promise.all(
        [...adapters.values()].map((adapter) => adapter.disconnect()),
      );
      adapters.clear();
    },
  };
}