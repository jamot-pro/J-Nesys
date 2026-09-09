import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type SessionLike = import("fastify").Session;

/**
 * Persistent session stores for @fastify/session.
 *
 * @fastify/session defaults to an in-memory store, which means every process
 * restart (redeploy, crash, Render instance recycle, `tsx watch` restart) logs
 * every user out. These stores persist sessions so a login survives restarts on
 * the same server/hardware.
 *
 * The store interface only requires three methods (see @fastify/session types):
 *   get(sessionId, cb), set(sessionId, session, cb), destroy(sessionId, cb)
 *
 * A session is a plain object whose keys (actorId, personId, ...) are the
 * session data plus a `cookie` field describing expiry. We persist both so the
 * session can be restored with the correct lifetime.
 */

export interface SessionCookie {
  expires?: string | number | Date | null;
  originalMaxAge?: number | null;
  originalExpires?: string | number | Date | null;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean | "auto";
  sameSite?: boolean | "lax" | "strict" | "none";
}

export interface SessionRecord {
  cookie?: SessionCookie;
  [key: string]: unknown;
}

export interface PersistentSessionStore {
  get(sessionId: string, callback: (err: unknown, session?: SessionLike | null) => void): void;
  set(sessionId: string, session: SessionLike, callback: (err?: unknown) => void): void;
  destroy(sessionId: string, callback: (err?: unknown) => void): void;
  close(): Promise<void>;
}

const SESSION_NAMESPACE = "jamot:session:";

function serialize(session: SessionRecord): string {
  return JSON.stringify(session);
}

function deserialize(raw: string): SessionRecord | null {
  try {
    const parsed = JSON.parse(raw) as SessionRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// --- File store -------------------------------------------------------------

function createFileStore(sessionDir: string): PersistentSessionStore {
  mkdirSync(sessionDir, { recursive: true });

  const fileFor = (sessionId: string): string => {
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(sessionDir, `${safe}.json`);
  };

  return {
    get(sessionId, callback) {
      try {
        const raw = readFileSync(fileFor(sessionId), "utf8");
        callback(null, deserialize(raw) as unknown as SessionLike);
      } catch {
        callback(null, null);
      }
    },
    set(sessionId, session, callback) {
      try {
        const file = fileFor(sessionId);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, serialize(session as unknown as SessionRecord), "utf8");
        callback();
      } catch (err) {
        callback(err);
      }
    },
    destroy(sessionId, callback) {
      try {
        rmSync(fileFor(sessionId), { force: true });
        callback();
      } catch (err) {
        callback(err);
      }
    },
    async close() {},
  };
}

// --- Redis store ------------------------------------------------------------

async function createRedisStore(redisUrl: string): Promise<PersistentSessionStore> {
  const { Redis } = await import("ioredis");
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
  await client.connect();

  return {
    get(sessionId, callback) {
      client
        .get(SESSION_NAMESPACE + sessionId)
        .then((raw: string | null) =>
          callback(null, raw ? (deserialize(raw) as unknown as SessionLike) : null),
        )
        .catch((err: unknown) => callback(err));
    },
    set(sessionId, session, callback) {
      const record = session as unknown as SessionRecord;
      const expires = record?.cookie?.expires;
      const expiresMs = expires instanceof Date ? expires.getTime() : typeof expires === "number" ? expires : expires ? Date.parse(expires) : NaN;
      const ttlSeconds =
        !Number.isNaN(expiresMs)
          ? Math.max(1, Math.round((expiresMs - Date.now()) / 1000))
          : 7 * 24 * 60 * 60;
      client
        .set(SESSION_NAMESPACE + sessionId, serialize(record), "EX", ttlSeconds)
        .then(() => callback())
        .catch((err: unknown) => callback(err));
    },
    destroy(sessionId, callback) {
      client
        .del(SESSION_NAMESPACE + sessionId)
        .then(() => callback())
        .catch((err: unknown) => callback(err));
    },
    async close() {
      client.disconnect();
    },
  };
}

// --- Selection --------------------------------------------------------------

/**
 * Build a persistent session store from the environment:
 *  - REDIS_URL is set          → Redis store (shared, survives restarts & scales)
 *  - SESSION_DIR / ./.data/sessions → file store (no infra, persists on disk)
 *  - otherwise                 → undefined, letting @fastify/session use MemoryStore
 */
export async function createSessionStore(): Promise<PersistentSessionStore | undefined> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      return await createRedisStore(redisUrl);
    } catch (err) {
      console.error("[session] redis store unavailable, falling back to file store", err);
    }
  }

  const sessionDir = process.env.SESSION_DIR ?? "./.data/sessions";
  if (sessionDir) {
    return createFileStore(sessionDir);
  }

  return undefined;
}
