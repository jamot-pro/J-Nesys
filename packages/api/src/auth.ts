import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { Actor, Person, Space } from "@jamot/contracts";
import type { FastifySessionOptions } from "@fastify/session";
import type { FastifyReply } from "fastify";
import type { JamotRepository } from "./repository.js";

const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64");
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function sessionOptions(
  secret: string,
  store?: FastifySessionOptions["store"],
): FastifySessionOptions {
  const key = secret.length >= 32 ? secret : createHash("sha256").update(secret).digest("hex");
  // COOKIE_DOMAIN (e.g. ".jamot.pro") shares the session cookie across all
  // subdomains so server-side Next.js routes on the app host can forward the
  // user's session to the API. Unset → host-only cookie (local dev).
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    secret: key,
    cookieName: "jamot_session",
    store,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: "auto",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      ...(domain ? { domain } : {}),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * When COOKIE_DOMAIN is set, older deployments may have left a HOST-ONLY
 * `jamot_session` cookie on the API host (no Domain attribute). A host-only
 * cookie and the new domain-wide cookie coexist and the stale one can shadow
 * the fresh session, logging the user out. Emit an expired host-only cookie
 * to clear it. Call right before establishing a new session on login.
 */
export function clearStaleHostOnlySessionCookie(reply: FastifyReply): void {
  if (!process.env.COOKIE_DOMAIN) return;
  void reply.header(
    "set-cookie",
    "jamot_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
  );
}

export interface ProvisionInput {
  email: string;
  displayName?: string;
  passwordHash: string | null;
  provider?: string | null;
  providerId?: string | null;
}

export interface RegisterResult {
  actor: Actor;
  person: Person;
  space: Space;
}

export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

export async function provisionUser(
  repo: JamotRepository,
  input: ProvisionInput,
): Promise<RegisterResult> {
  const displayName = input.displayName ?? input.email.split("@")[0] ?? input.email;
  const actor = await repo.createActor({ type: "human", displayName });
  const space = await repo.createSpace({ kind: "personal", ownerActorId: actor.id, name: displayName });
  const actorWithSpace = await repo.updateActor(actor.id, { personalSpaceId: space.id });
  const person = await repo.createPerson({
    actorId: actor.id,
    email: input.email.toLowerCase(),
    membershipSpaceIds: [space.id],
  });
  await repo.createUser({
    person,
    actor: actorWithSpace ?? actor,
    passwordHash: input.passwordHash,
    provider: input.provider ?? null,
    providerId: input.providerId ?? null,
    isSuperAdmin: superAdminEmails().includes(input.email.toLowerCase()),
  });
  await repo.createRole({ actorId: actor.id, spaceId: space.id, kind: "owner" });
  return { actor: actorWithSpace ?? actor, person, space };
}

export async function registerPerson(
  repo: JamotRepository,
  input: RegisterInput,
): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);
  return provisionUser(repo, {
    email: input.email,
    displayName: input.displayName,
    passwordHash,
  });
}

// --- Google OAuth ---

export interface GoogleTokens {
  accessToken: string;
  idToken?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string; id_token?: string };
  if (!data.access_token) throw new Error("google token exchange returned no access_token");
  return { accessToken: data.access_token, idToken: data.id_token };
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
  const data = (await res.json()) as { sub?: string; email?: string; name?: string };
  if (!data.sub || !data.email) throw new Error("google userinfo missing sub/email");
  return { sub: data.sub, email: data.email, name: data.name };
}
