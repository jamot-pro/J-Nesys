import type { ChannelAdapter, InboundMessage } from "./channel.js";

export interface TelegramAdapterOpts {
  id?: string;
  token: string;
  apiUrl?: string;
  /** Polling timeout in seconds (long-poll). */
  pollTimeout?: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: { id: number };
    date: number;
    text?: string;
  };
}

export function createTelegramAdapter(opts: TelegramAdapterOpts): ChannelAdapter {
  const id = opts.id ?? "telegram";
  const baseUrl = opts.apiUrl ?? `https://api.telegram.org/bot${opts.token}`;
  const pollTimeout = opts.pollTimeout ?? 30;
  const handlers = new Set<(msg: InboundMessage) => void>();

  let running = false;
  let offset: number | undefined;
  let pollController: AbortController | undefined;

  async function callApi(method: string, params: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(`telegram api ${method} failed: ${res.status}`);
    }
    return res.json();
  }

  function handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message?.text) return;
    const sender = message.from?.id;
    if (sender === undefined) return;
    const text = message.text;
    for (const handler of handlers) {
      handler({
        channelId: id,
        kind: "telegram",
        sender: String(sender),
        text,
        timestamp: new Date(message.date * 1000).toISOString(),
        room: String(message.chat.id),
        raw: message,
      });
    }
  }

  async function poll() {
    while (running) {
      pollController = new AbortController();
      try {
        const res = await fetch(
          `${baseUrl}/getUpdates?offset=${offset ?? ""}&timeout=${pollTimeout}`,
          { signal: pollController.signal },
        );
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const data = (await res.json()) as { result?: TelegramUpdate[] };
        for (const update of data.result ?? []) {
          offset = update.update_id + 1;
          handleUpdate(update);
        }
      } catch (err) {
        if (!running) break;
        if ((err as Error).name !== "AbortError") {
          console.error("[telegram] poll error", err);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  return {
    id,
    kind: "telegram",

    async connect() {
      if (running) return;
      running = true;
      void poll();
    },

    async disconnect() {
      running = false;
      pollController?.abort();
      pollController = undefined;
    },

    async send(recipient, text) {
      if (!running) throw new Error("telegram adapter not connected");
      await callApi("sendMessage", { chat_id: recipient, text });
    },

    onMessage(handler) {
      handlers.add(handler);
    },
  };
}
