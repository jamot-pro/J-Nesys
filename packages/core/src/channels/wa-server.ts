import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { WaMediaInput, WhatsAppAdapter } from "./whatsapp.js";
import type { WhatsAppManager } from "./manager.js";

export interface WhatsAppControlServerOpts {
  host?: string;
  port?: number;
}

export interface WhatsAppControlServer {
  port: number;
  start(): Promise<void>;
  close(): Promise<void>;
}

function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function createWhatsAppControlServer(
  manager: WhatsAppManager,
  opts: WhatsAppControlServerOpts = {},
): WhatsAppControlServer {
  const host = opts.host ?? "0.0.0.0";
  const port = opts.port ?? 0;
  let server: Server | undefined;

  const json = (
    res: import("node:http").ServerResponse,
    code: number,
    body: unknown,
  ) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const route = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ): Promise<void> => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const path = url.pathname;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && path === "/health") {
        return json(res, 200, { ok: true });
      }
      if (method === "GET" && path === "/net/meta") {
        return json(res, 200, {
          internalHostname: process.env.RENDER_INTERNAL_HOSTNAME ?? null,
        });
      }

      // Account-scoped routes: /accounts/:id/<...>
      const match = /^\/accounts\/([^/]+)(?:\/([^/]+))?$/.exec(path);
      if (!match) return json(res, 404, { error: "not found" });

      const accountId = decodeURIComponent(match[1]!);
      const sub = match[2] ?? "state";
      const adapter =
        manager.get(accountId) ?? manager.ensure(accountId);

      const requireAuth = (): boolean => {
        const secret = process.env.WA_CONTROL_SECRET;
        if (secret && req.headers["x-control-secret"] !== secret) {
          json(res, 403, { error: "forbidden" });
          return false;
        }
        return true;
      };

      if (method === "GET" && sub === "state") {
        return json(res, 200, adapter.getState());
      }
      if (method === "POST" && sub === "reset") {
        await adapter.resetSession();
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && sub === "logout") {
        await adapter.disconnect();
        await manager.remove(accountId);
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && sub === "session") {
        if (!requireAuth()) return;
        const body = (await readJson(req)) as {
          files?: Record<string, string>;
        };
        if (!body.files || Object.keys(body.files).length === 0) {
          return json(res, 400, { error: "files is required" });
        }
        await adapter.importSession(body.files);
        return json(res, 200, { ok: true });
      }
      if (method === "GET" && sub === "chats") {
        return json(res, 200, { items: adapter.listChats() });
      }
      if (method === "GET" && sub === "contacts") {
        const q = url.searchParams.get("q") ?? undefined;
        return json(res, 200, { items: adapter.listContacts(q) });
      }
      if (method === "GET" && sub === "messages") {
        const jid = url.searchParams.get("jid") ?? "";
        if (!jid) return json(res, 400, { error: "jid is required" });
        const before = url.searchParams.get("before");
        const limit = url.searchParams.get("limit");
        const optsArg: { before?: number; limit?: number } = {};
        if (before) optsArg.before = Number(before);
        if (limit) optsArg.limit = Number(limit);
        return json(res, 200, { items: adapter.getMessages(jid, optsArg) });
      }
      if (method === "GET" && sub === "search") {
        const q = url.searchParams.get("q") ?? "";
        return json(res, 200, { items: adapter.searchMessages(q) });
      }
      if (method === "POST" && sub === "send") {
        const body = (await readJson(req)) as { jid?: string; text?: string };
        if (!body.jid || !body.text)
          return json(res, 400, { error: "jid and text are required" });
        await adapter.sendText(body.jid, body.text);
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && sub === "media") {
        const media = (await readJson(req)) as WaMediaInput;
        if (!media.jid || !media.type || !media.data)
          return json(res, 400, { error: "jid, type and data are required" });
        await adapter.sendMedia(media);
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && sub === "read") {
        const body = (await readJson(req)) as { jid?: string };
        if (!body.jid) return json(res, 400, { error: "jid is required" });
        await adapter.markRead(body.jid);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      return json(res, 500, { error: message });
    }
  };

  return {
    port,

    start() {
      return new Promise<void>((resolve, reject) => {
        server = createServer((req, res) => {
          void route(req, res).catch((err) => {
            const message = err instanceof Error ? err.message : "internal error";
            json(res, 500, { error: message });
          });
        });
        const onError = (err: Error) => {
          server?.off("error", onError);
          reject(err);
        };
        server.on("error", onError);
        server.listen(port, host, () => {
          server?.off("error", onError);
          const address = server?.address() as AddressInfo | string | null;
          if (address && typeof address === "object") this.port = address.port;
          resolve();
        });
      });
    },

    close() {
      return new Promise<void>((resolve, reject) => {
        if (!server) return resolve();
        server.close((err) => (err ? reject(err) : resolve()));
        server = undefined;
      });
    },
  };
}