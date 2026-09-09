import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { ChannelAdapter, InboundMessage } from "./channel.js";

export type WaConnection = "connecting" | "open" | "close";

export interface WaState {
  connection: WaConnection;
  qr?: string;
}

export interface WaChat {
  jid: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  isGroup: boolean;
}

export interface WaContact {
  jid: string;
  name: string;
}

export interface WaMessage {
  id: string;
  jid: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  mediaType: string | null;
}

export interface WaMediaInput {
  jid: string;
  type: "image" | "video" | "audio";
  data: string; // base64 (without data URL prefix) or data URL
  caption?: string;
  filename?: string;
  mimetype?: string;
}

export interface WhatsAppAdapterOpts {
  id?: string;
  sessionDir: string;
  creds?: { type: "baileys"; [k: string]: unknown };
  syncFullHistory?: boolean;
  proxyUrl?: string;
}

export interface WhatsAppAdapter extends ChannelAdapter {
  kind: "whatsapp";
  getState(): WaState;
  resetSession(): Promise<void>;
  importSession(files: Record<string, string>): Promise<void>;
  listChats(): WaChat[];
  listContacts(query?: string): WaContact[];
  getMessages(
    jid: string,
    opts?: { before?: number; limit?: number },
  ): WaMessage[];
  searchMessages(query: string): WaMessage[];
  sendText(jid: string, text: string): Promise<void>;
  sendMedia(input: WaMediaInput): Promise<void>;
  markRead(jid: string): Promise<void>;
}

function toJid(recipient: string): string {
  if (recipient.includes("@")) return recipient;
  return `${recipient}@s.whatsapp.net`;
}

function messageText(
  msg: WAMessage,
): { text: string; mediaType: string | null } {
  const m = msg.message;
  if (!m) return { text: "", mediaType: null };
  if (m.conversation) return { text: m.conversation, mediaType: null };
  if (m.extendedTextMessage?.text)
    return { text: m.extendedTextMessage.text, mediaType: null };
  if (m.imageMessage)
    return { text: m.imageMessage.caption ?? "", mediaType: "image" };
  if (m.videoMessage)
    return { text: m.videoMessage.caption ?? "", mediaType: "video" };
  if (m.audioMessage) return { text: "", mediaType: "audio" };
  if (m.stickerMessage) return { text: "", mediaType: "sticker" };
  if (m.documentMessage)
    return { text: m.documentMessage.fileName ?? "", mediaType: "document" };
  if (m.contactMessage)
    return { text: m.contactMessage.displayName ?? "", mediaType: "contact" };
  if (m.locationMessage) return { text: "Location", mediaType: "location" };
  return { text: "", mediaType: null };
}

function messageSender(msg: WAMessage): string {
  const key = msg.key;
  const remote = key.remoteJid ?? "";
  if (remote.endsWith("@g.us") && key.participant) return key.participant;
  return remote;
}

export function createWhatsAppAdapter(
  opts: WhatsAppAdapterOpts,
): WhatsAppAdapter {
  const id = opts.id ?? "whatsapp";
  const sessionDir = opts.sessionDir;
  const syncFullHistory = opts.syncFullHistory ?? true;
  const proxyUrl = opts.proxyUrl;
  const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
  const handlers = new Set<(msg: InboundMessage) => void>();
  let sock: WASocket | undefined;
  let connecting = false;

  const state: WaState = { connection: "connecting" };
  const chats = new Map<string, WaChat>();
  const contacts = new Map<string, string>(); // jid -> name
  const messages = new Map<string, WaMessage[]>(); // jid -> messages

  let reconnectDelayMs = 5000;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  // Consecutive loggedOut/badSession closes without an intervening `open`.
  // A single transient 401/500 (e.g. an unclean restart of the process that
  // owned the socket) must NOT wipe the saved credentials — only after this
  // many consecutive failures do we treat the session as genuinely invalid
  // and re-pair.
  const MAX_BAD_SESSION_WIPES = 3;
  let badSessionStreak = 0;

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (state.connection === "close") {
      const jittered = Math.round(
        reconnectDelayMs * (0.75 + Math.random() * 0.5),
      );
      console.log(`[whatsapp] reconnect in ${jittered}ms`);
      reconnectTimer = setTimeout(() => void connect(), jittered);
    }
  };

  // Wipe the persisted auth state so the next connect starts a fresh pairing
  // loop. Called after a genuine logout / unrecoverable bad session, where
  // Baileys would otherwise loop forever without ever emitting a new QR.
  const wipeSession = () => {
    try {
      rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // session dir may be locked or already gone
    }
    state.qr = undefined;
    state.connection = "connecting";
    reconnectDelayMs = 5000;
    badSessionStreak = 0;
  };

  const nameFor = (jid: string): string => {
    const contact = contacts.get(jid);
    if (contact) return contact;
    const chat = chats.get(jid);
    if (chat?.name) return chat.name;
    return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
  };

  const upsertMessage = (jid: string, msg: WAMessage) => {
    const { text, mediaType } = messageText(msg);
    if (!text && !mediaType) return;
    const list = messages.get(jid) ?? [];
    const existing = list.find((m) => m.id === msg.key.id);
    if (existing) return;
    const fromMe = msg.key.fromMe ?? false;
    const ts =
      typeof msg.messageTimestamp === "number"
        ? msg.messageTimestamp
        : Math.floor(Date.now() / 1000);
    list.push({
      id: msg.key.id ?? `m${Date.now()}`,
      jid,
      fromMe,
      text,
      timestamp: ts,
      mediaType,
    });
    list.sort((a, b) => a.timestamp - b.timestamp);
    messages.set(jid, list);

    const chat = chats.get(jid);
    if (chat) {
      chat.lastMessage = text || mediaType || "";
      chat.timestamp = ts;
      if (!fromMe) chat.unread += 1;
    }
  };

  const connect = async () => {
    if (connecting) return;
    connecting = true;
    try {
      const { state: authState, saveCreds } =
        await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys),
        },
        // No `browser` override: Baileys defaults to macOS/Chrome, which
        // registers as a regular web client (WEB_BROWSER). Overriding with a
        // "Desktop" browser flags the connection as the macOS WhatsApp app
        // (DARWIN sub-platform), which WhatsApp terminates with 428 during
        // registration. Matches the leadpilot-proven configuration.
        syncFullHistory,
        agent: proxyAgent,
        fetchAgent: proxyAgent,
      });
      sock = socket;

      socket.ev.on("creds.update", saveCreds);

      socket.ev.on("connection.update", (update) => {
        if (update.qr) {
          state.connection = "connecting";
          state.qr = update.qr;
          console.log(
            "[whatsapp] pairing QR generated",
            update.qr.slice(0, 16),
          );
        }
        if (update.connection === "open") {
          state.connection = "open";
          state.qr = undefined;
          reconnectDelayMs = 5000;
          badSessionStreak = 0;
        }
        if (update.connection === "close") {
          state.connection = "close";
          state.qr = undefined;
          const statusCode = (
            update.lastDisconnect?.error as
              | { output?: { statusCode?: number } }
              | undefined
          )?.output?.statusCode;
          const errorMessage =
            update.lastDisconnect?.error instanceof Error
              ? update.lastDisconnect.error.message
              : undefined;
          console.log(
            `[whatsapp] connection closed${
              statusCode !== undefined ? `, status=${statusCode}` : ""
            }${errorMessage ? ` — ${errorMessage}` : ""}`,
          );
          if (statusCode === DisconnectReason.restartRequired) {
            // WhatsApp asked us to restart the socket — no backoff, no wipe.
            console.log("[whatsapp] restart required — reconnecting immediately");
            void connect();
            return;
          }
          if (
            statusCode === DisconnectReason.loggedOut ||
            statusCode === DisconnectReason.badSession
          ) {
            badSessionStreak += 1;
            if (badSessionStreak >= MAX_BAD_SESSION_WIPES) {
              console.log(
                `[whatsapp] session invalid after ${badSessionStreak} consecutive failures (${statusCode}) — wiping, will re-pair`,
              );
              wipeSession();
              void connect();
              return;
            }
            // Transient 401/500: keep the saved credentials and reconnect so
            // the session resumes instead of forcing a fresh scan.
            console.log(
              `[whatsapp] transient invalid session (${statusCode}, streak=${badSessionStreak}/${MAX_BAD_SESSION_WIPES}) — reconnecting with saved creds`,
            );
            reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
            scheduleReconnect();
            return;
          }
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
          scheduleReconnect();
        }
      });

      socket.ev.on("contacts.upsert", (upserts) => {
        for (const c of upserts) {
          if (c.id && (c.name || c.notify)) {
            contacts.set(c.id, c.name ?? c.notify ?? "");
          }
        }
      });

      socket.ev.on("contacts.update", (updates) => {
        for (const c of updates) {
          if (c.id && (c.name || c.notify)) {
            contacts.set(c.id, c.name ?? c.notify ?? "");
          }
        }
      });

      socket.ev.on("chats.upsert", (upserts) => {
        for (const c of upserts) {
          const jid = c.id;
          if (!jid) continue;
          const existing = chats.get(jid);
          chats.set(jid, {
            jid,
            name: c.name ?? existing?.name ?? nameFor(jid),
            lastMessage: existing?.lastMessage ?? "",
            timestamp: Number(
              c.conversationTimestamp ?? c.lastMessageRecvTimestamp ?? 0,
            ),
            unread: Number(c.unreadCount ?? existing?.unread ?? 0),
            isGroup: isJidGroup(jid) ?? false,
          });
        }
      });

      socket.ev.on("chats.update", (updates) => {
        for (const c of updates) {
          const jid = c.id;
          if (!jid) continue;
          const existing = chats.get(jid);
          chats.set(jid, {
            jid,
            name: c.name ?? existing?.name ?? nameFor(jid),
            lastMessage: existing?.lastMessage ?? "",
            timestamp: Number(
              c.conversationTimestamp ?? existing?.timestamp ?? 0,
            ),
            unread: Number(c.unreadCount ?? existing?.unread ?? 0),
            isGroup: isJidGroup(jid) ?? false,
          });
        }
      });

      socket.ev.on("messaging-history.set", (history) => {
        for (const chat of history.chats) {
          const jid = chat.id;
          if (!jid) continue;
          chats.set(jid, {
            jid,
            name: chat.name ?? nameFor(jid),
            lastMessage: "",
            timestamp: Number(
              chat.conversationTimestamp ?? chat.lastMessageRecvTimestamp ?? 0,
            ),
            unread: Number(chat.unreadCount ?? 0),
            isGroup: isJidGroup(jid) ?? false,
          });
        }
        const perChat = new Map<string, WaMessage[]>();
        for (const msg of history.messages ?? []) {
          const jid = msg.key.remoteJid ?? "";
          if (!jid) continue;
          const { text, mediaType } = messageText(msg);
          if (!text && !mediaType) continue;
          const list = perChat.get(jid) ?? [];
          list.push({
            id: msg.key.id ?? `m${Date.now()}-${Math.random()}`,
            jid,
            fromMe: msg.key.fromMe ?? false,
            text,
            timestamp:
              typeof msg.messageTimestamp === "number"
                ? msg.messageTimestamp
                : 0,
            mediaType,
          });
          perChat.set(jid, list);
        }
        for (const [jid, incoming] of perChat) {
          const byId = new Map<string, WaMessage>();
          for (const m of messages.get(jid) ?? []) byId.set(m.id, m);
          for (const m of incoming) byId.set(m.id, m);
          const merged = [...byId.values()].sort(
            (a, b) => a.timestamp - b.timestamp,
          );
          messages.set(jid, merged);
          const chatEntry = chats.get(jid);
          if (chatEntry && merged.length > 0) {
            const last = merged[merged.length - 1];
            if (last) chatEntry.lastMessage = last.text || last.mediaType || "";
          }
        }
        for (const c of history.contacts ?? []) {
          if (c.id && (c.name || c.notify)) {
            contacts.set(c.id, c.name ?? c.notify ?? "");
          }
        }
      });

      socket.ev.on("messages.upsert", ({ messages: msgs }) => {
        for (const msg of msgs) {
          const jid = msg.key.fromMe
            ? (msg.key.remoteJid ?? "")
            : messageSender(msg);
          if (jid) upsertMessage(jid, msg);
          if (msg.key.fromMe) continue;
          const { text } = messageText(msg);
          if (!text) continue;
          const sender = messageSender(msg)
            .replace(/@s\.whatsapp\.net$/, "")
            .replace(/@g\.us$/, "");
          const ts =
            typeof msg.messageTimestamp === "number"
              ? msg.messageTimestamp
              : Math.floor(Date.now() / 1000);
          const inbound: InboundMessage = {
            channelId: id,
            kind: "whatsapp",
            sender,
            text,
            timestamp: new Date(ts * 1000).toISOString(),
            raw: msg,
          };
          for (const handler of handlers) handler(inbound);
        }
      });
    } finally {
      connecting = false;
    }
  };

  void connect();

  return {
    id,
    kind: "whatsapp",

    async connect() {
      void connect();
    },

    async disconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (sock) {
        await sock.end(undefined);
        sock = undefined;
      }
    },

    async resetSession() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (sock) {
        await sock.end(undefined);
        sock = undefined;
      }
      wipeSession();
      void connect();
    },

    async importSession(files) {
      const root = normalize(sessionDir);
      mkdirSync(root, { recursive: true });
      for (const [relPath, content] of Object.entries(files)) {
        const target = normalize(join(root, relPath));
        if (!target.startsWith(root + sep) && target !== root) {
          throw new Error(`invalid session file path: ${relPath}`);
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(content, "base64"));
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (sock) {
        await sock.end(undefined);
        sock = undefined;
      }
      state.qr = undefined;
      state.connection = "connecting";
      reconnectDelayMs = 5000;
      void connect();
    },

    onMessage(handler) {
      handlers.add(handler);
    },

    async send(recipient, text) {
      await this.sendText(toJid(recipient), text);
    },

    getState() {
      return { ...state };
    },

    listChats() {
      return [...chats.values()]
        .filter((c) => c.timestamp > 0 || c.lastMessage)
        .sort((a, b) => b.timestamp - a.timestamp);
    },

    listContacts(query) {
      const q = query?.trim().toLowerCase();
      const seen = new Set<string>();
      const result: WaContact[] = [];
      for (const [jid, name] of contacts) {
        if (!jid.endsWith("@s.whatsapp.net")) continue;
        if (seen.has(jid)) continue;
        seen.add(jid);
        if (!q || name.toLowerCase().includes(q) || jid.includes(q)) {
          result.push({ jid, name });
        }
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },

    getMessages(jid, opts) {
      const list = messages.get(jid) ?? [];
      let filtered = list;
      if (opts?.before) {
        filtered = filtered.filter((m) => m.timestamp < opts.before!);
      }
      const limit = opts?.limit ?? 100;
      return filtered.slice(-limit);
    },

    searchMessages(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const result: WaMessage[] = [];
      for (const list of messages.values()) {
        for (const m of list) {
          if (m.text.toLowerCase().includes(q)) result.push(m);
        }
      }
      return result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 200);
    },

    async sendText(jid, text) {
      if (!sock) throw new Error("whatsapp not connected");
      const target = toJid(jid);
      await sock.sendMessage(target, { text });
      upsertMessage(target, {
        key: { remoteJid: target, fromMe: true, id: `s${Date.now()}` },
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: text },
      } as unknown as WAMessage);
    },

    async sendMedia(input) {
      if (!sock) throw new Error("whatsapp not connected");
      const base64 = input.data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const payload = {
        [input.type]: buffer,
        caption: input.caption,
        ...(input.type === "audio"
          ? { mimetype: input.mimetype ?? "audio/mpeg", ptt: true }
          : { mimetype: input.mimetype ?? "application/octet-stream" }),
      };
      await sock.sendMessage(toJid(input.jid), payload as never);
    },

    async markRead(jid) {
      if (!sock) return;
      const target = toJid(jid);
      const list = messages.get(target) ?? [];
      const toRead = list
        .filter((m) => !m.fromMe)
        .map((m) => ({ remoteJid: target, id: m.id }));
      if (toRead.length > 0) await sock.readMessages(toRead);
      const chat = chats.get(target);
      if (chat) chat.unread = 0;
    },
  };
}
