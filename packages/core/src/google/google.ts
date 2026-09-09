import type { Actor, Connector, Person } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { SecretStore } from "../secrets/secret-store.js";

/**
 * Google connector: People API import + Gmail sender ingestion.
 * Google is a connected SOURCE — Jamot stays the canonical Person layer.
 * One-way import/read sync; write-back is intentionally deferred.
 */

export const GOOGLE_CONNECTOR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const GOOGLE_IDENTITY_PROVIDER = "google";
export const GMAIL_IDENTITY_PROVIDER = "gmail";

export function buildGoogleConnectorAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CONNECTOR_SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export async function exchangeGoogleConnectorCode(
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
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("google token exchange returned no access_token");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`google token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("google token refresh returned no access_token");
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

interface GoogleConnection {
  resourceName?: string;
  names?: { displayName?: string; givenName?: string; familyName?: string }[];
  phoneNumbers?: { value?: string }[];
  emailAddresses?: { value?: string }[];
  photos?: { url?: string; default?: boolean }[];
}

export async function fetchGoogleConnections(
  accessToken: string,
  pageToken?: string,
): Promise<{ connections: GoogleConnection[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    personFields: "names,phoneNumbers,emailAddresses,photos",
    pageSize: "100",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(
    `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`google people api failed: ${res.status}`);
  const data = (await res.json()) as {
    connections?: GoogleConnection[];
    nextPageToken?: string;
  };
  return { connections: data.connections ?? [], nextPageToken: data.nextPageToken };
}

export interface GmailSender {
  name?: string;
  email: string;
  timestamp: string;
}

function parseFromHeader(value: string): { name?: string; email: string } | null {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]!.replace(/^"|"$/g, "").trim();
    return { name: name || undefined, email: match[2]!.trim().toLowerCase() };
  }
  const plain = value.trim().toLowerCase();
  if (plain.includes("@")) return { email: plain };
  return null;
}

/** Extract senders of recent inbound Gmail messages. */
export async function fetchGmailSenders(
  accessToken: string,
  sinceIso: string,
  maxMessages = 100,
): Promise<GmailSender[]> {
  const since = new Date(sinceIso);
  const after = `${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()}`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${after}&maxResults=${maxMessages}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`gmail list failed: ${listRes.status}`);
  const listData = (await listRes.json()) as { messages?: { id: string }[] };

  const senders = new Map<string, GmailSender>();
  for (const message of listData.messages ?? []) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as {
      internalDate?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const from = data.payload?.headers?.find((h) => h.name === "From")?.value;
    if (!from) continue;
    const parsed = parseFromHeader(from);
    if (!parsed || !parsed.email.includes("@")) continue;
    if (!senders.has(parsed.email)) {
      senders.set(parsed.email, {
        name: parsed.name,
        email: parsed.email,
        timestamp: data.internalDate
          ? new Date(Number(data.internalDate)).toISOString()
          : new Date().toISOString(),
      });
    }
  }
  return [...senders.values()];
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export interface GoogleSyncDeps {
  repo: JamotRepository;
  store: SecretStore;
  clientId: string;
  clientSecret: string;
}

export interface GoogleSyncResult {
  contacts: number;
  senders: number;
}

export interface GoogleSyncService {
  syncConnector(connector: Connector): Promise<GoogleSyncResult>;
}

/**
 * Attach an identity to a person; when the identity is already held by a
 * different person, record a merge candidate instead of silently re-linking.
 */
async function linkIdentity(
  repo: JamotRepository,
  input: {
    actorId: string;
    personId: string;
    provider: string;
    value: string;
    source: string;
    spaceId: string | null;
  },
): Promise<void> {
  const identity = await repo.addIdentity({
    actorId: input.actorId,
    personId: input.personId,
    provider: input.provider,
    value: input.value,
    verified: true,
    confidence: 1,
    source: input.source,
  });
  if (identity.personId && identity.personId !== input.personId) {
    await repo.createMergeCandidate({
      spaceId: input.spaceId,
      personAId: identity.personId,
      personBId: input.personId,
      reason: `${input.provider} ${input.value} matches another person`,
      detail: { provider: input.provider, value: input.value, source: input.source },
    });
    await repo.recordEvent({
      type: "person.merge.proposed",
      spaceId: input.spaceId,
      actorId: input.actorId,
      payload: { personAId: identity.personId, personBId: input.personId },
    });
  }
}

async function ensureMembership(
  repo: JamotRepository,
  person: Person,
  spaceId: string | null,
): Promise<Person> {
  if (!spaceId || person.membershipSpaceIds.includes(spaceId as never)) return person;
  const updated = await repo.updatePerson(person.id, {
    membershipSpaceIds: [...person.membershipSpaceIds, spaceId] as Person["membershipSpaceIds"],
  });
  return updated ?? person;
}

export function createGoogleSyncService(deps: GoogleSyncDeps): GoogleSyncService {
  const { repo, store, clientId, clientSecret } = deps;

  async function resolveAccessToken(connector: Connector): Promise<string> {
    const secret = await repo.getSecret(connector.credentialRef.ref);
    if (!secret) throw new Error("google connector has no stored refresh token");
    const refreshToken = store.decrypt(secret.ciphertext);
    const tokens = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
    return tokens.accessToken;
  }

  async function upsertContact(
    contact: GoogleConnection,
    spaceId: string | null,
  ): Promise<void> {
    const resourceName = contact.resourceName;
    if (!resourceName) return;

    const name = contact.names?.[0];
    const firstName = name?.givenName?.trim() || null;
    const lastName = name?.familyName?.trim() || null;
    const displayName = name?.displayName?.trim();
    const emails = (contact.emailAddresses ?? [])
      .map((e) => e.value?.trim().toLowerCase())
      .filter((v): v is string => Boolean(v));
    const phones = (contact.phoneNumbers ?? [])
      .map((p) => digitsOnly(p.value ?? ""))
      .filter((d) => d.length >= 7);
    const photo =
      (contact.photos ?? []).find((p) => !p.default && p.url)?.url ??
      (contact.photos ?? [])[0]?.url ??
      null;

    let actor: Actor | null = await repo.findActorByIdentity(
      GOOGLE_IDENTITY_PROVIDER,
      resourceName,
    );
    let person: Person | null = actor ? await repo.findPersonByActorId(actor.id) : null;

    if (!person) {
      for (const email of emails) {
        const existing = await repo.findPersonByEmail(email);
        if (existing) {
          person = existing;
          actor = await repo.getActor(existing.actorId);
          break;
        }
      }
    }
    if (!person) {
      for (const phone of phones) {
        const existing = await repo.findPersonByPhone(phone);
        if (existing) {
          person = existing;
          actor = await repo.getActor(existing.actorId);
          break;
        }
      }
    }

    if (!person || !actor) {
      actor = await repo.createActor({
        type: "human",
        source: "external",
        displayName: displayName ?? emails[0] ?? phones[0] ?? resourceName,
        externalIdentities: [],
      });
      person = await repo.createPerson({
        actorId: actor.id,
        email: emails[0] ?? null,
        firstName,
        lastName,
        phone: phones[0] ?? null,
        avatarUrl: photo,
        avatarSource: photo ? "google" : null,
        membershipSpaceIds: spaceId ? [spaceId] : [],
      });
      await repo.recordEvent({
        type: "person.created",
        spaceId,
        actorId: actor.id,
        payload: { personId: person.id, provider: "google", value: resourceName },
      });
    } else {
      const patch: Parameters<JamotRepository["updatePerson"]>[1] = {};
      if (!person.firstName && firstName) patch.firstName = firstName;
      if (!person.lastName && lastName) patch.lastName = lastName;
      if (!person.email && emails[0]) patch.email = emails[0];
      if (!person.phone && phones[0]) patch.phone = phones[0];
      if (!person.avatarUrl && photo) {
        patch.avatarUrl = photo;
      }
      if (Object.keys(patch).length > 0) {
        person = (await repo.updatePerson(person.id, patch)) ?? person;
      }
      person = await ensureMembership(repo, person, spaceId);
    }

    await linkIdentity(repo, {
      actorId: actor.id,
      personId: person.id,
      provider: GOOGLE_IDENTITY_PROVIDER,
      value: resourceName,
      source: "google_contacts",
      spaceId,
    });
    for (const email of emails) {
      await linkIdentity(repo, {
        actorId: actor.id,
        personId: person.id,
        provider: "email",
        value: email,
        source: "google_contacts",
        spaceId,
      });
    }
    for (const phone of phones) {
      await linkIdentity(repo, {
        actorId: actor.id,
        personId: person.id,
        provider: "phone",
        value: phone,
        source: "google_contacts",
        spaceId,
      });
    }
  }

  async function upsertGmailSender(sender: GmailSender, spaceId: string | null): Promise<void> {
    let person = await repo.findPersonByEmail(sender.email);
    let actor: Actor | null = person ? await repo.getActor(person.actorId) : null;

    if (!person || !actor) {
      const nameParts = (sender.name ?? "").split(/\s+/).filter(Boolean);
      actor = await repo.createActor({
        type: "human",
        source: "external",
        displayName: sender.name ?? sender.email,
        externalIdentities: [],
      });
      person = await repo.createPerson({
        actorId: actor.id,
        email: sender.email,
        firstName: nameParts[0] ?? null,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
        membershipSpaceIds: spaceId ? [spaceId] : [],
      });
      await repo.recordEvent({
        type: "person.created",
        spaceId,
        actorId: actor.id,
        payload: { personId: person.id, provider: "gmail", value: sender.email },
      });
    } else if (sender.name && !person.firstName) {
      const nameParts = sender.name.split(/\s+/).filter(Boolean);
      const updated = await repo.updatePerson(person.id, {
        firstName: nameParts[0] ?? null,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
      });
      if (updated) person = updated;
    }

    await repo.updatePerson(person.id, { lastInteractionAt: sender.timestamp });

    await linkIdentity(repo, {
      actorId: actor.id,
      personId: person.id,
      provider: "email",
      value: sender.email,
      source: "gmail",
      spaceId,
    });
    await linkIdentity(repo, {
      actorId: actor.id,
      personId: person.id,
      provider: GMAIL_IDENTITY_PROVIDER,
      value: sender.email,
      source: "gmail",
      spaceId,
    });
  }

  return {
    async syncConnector(connector) {
      const accessToken = await resolveAccessToken(connector);
      const configuration = connector.configuration as {
        spaceId?: string;
        lastSyncAt?: string;
      };
      const spaceId = configuration.spaceId ?? null;

      let contacts = 0;
      let pageToken: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const result = await fetchGoogleConnections(accessToken, pageToken);
        for (const contact of result.connections) {
          await upsertContact(contact, spaceId);
          contacts += 1;
        }
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      const sinceIso = configuration.lastSyncAt ?? new Date(Date.now() - 14 * 86400000).toISOString();
      const senders = await fetchGmailSenders(accessToken, sinceIso);
      for (const sender of senders) {
        await upsertGmailSender(sender, spaceId);
      }

      const now = new Date().toISOString();
      await repo.updateConnector(connector.id, {
        status: "connected",
        configuration: {
          ...connector.configuration,
          lastSyncAt: now,
          contactsSynced: contacts,
          sendersSynced: senders.length,
        },
      });

      return { contacts, senders: senders.length };
    },
  };
}
