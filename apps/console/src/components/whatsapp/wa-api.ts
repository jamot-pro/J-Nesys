import { API_URL } from "@/components/auth/auth-context";
import type { WaAccount, WaChat, WaContact, WaMessage, WaState } from "./wa-data";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      // Only claim JSON when a body is actually sent — Fastify rejects
      // body-less requests that carry a JSON content-type with a 400.
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(body.message ?? body.error ?? `request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export async function listAccounts(spaceId: string): Promise<WaAccount[]> {
  const data = await api<{ items: WaAccount[] }>(
    `/api/wa/accounts?spaceId=${enc(spaceId)}`,
  );
  return data.items;
}

export async function createAccount(
  spaceId: string,
  label: string,
): Promise<WaAccount> {
  return api<WaAccount>("/api/wa/accounts", {
    method: "POST",
    body: JSON.stringify({ spaceId, label }),
  });
}

export async function deleteAccount(id: string): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(id)}`, { method: "DELETE" });
}

export interface ChannelAccount {
  id: string;
  spaceId: string;
  protocol: "telegram" | "matrix";
  label: string;
  identifier: string | null;
  token: string | null | boolean;
  status: "offline" | "pairing" | "connecting" | "connected" | "error";
  createdAt: string;
  updatedAt: string;
}

export async function listChannelAccounts(spaceId: string): Promise<ChannelAccount[]> {
  const data = await api<{ items: ChannelAccount[] }>(
    `/api/wa/channels?spaceId=${enc(spaceId)}`,
  );
  return data.items;
}

export async function createChannelAccount(
  spaceId: string,
  protocol: "telegram" | "matrix",
  label: string,
  opts: { token?: string; identifier?: string } = {},
): Promise<ChannelAccount> {
  return api<ChannelAccount>("/api/wa/channels", {
    method: "POST",
    body: JSON.stringify({ spaceId, protocol, label, ...opts }),
  });
}

export async function deleteChannelAccount(id: string): Promise<unknown> {
  return api(`/api/wa/channels/${enc(id)}`, { method: "DELETE" });
}

export function getState(accountId: string): Promise<WaState> {
  return api<WaState>(`/api/wa/accounts/${enc(accountId)}/state`);
}

export function resetPairing(accountId: string): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/reset`, { method: "POST" });
}

export function logoutAccount(accountId: string): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/logout`, { method: "POST" });
}

export async function listChats(accountId: string): Promise<WaChat[]> {
  const data = await api<{ items: WaChat[] }>(
    `/api/wa/accounts/${enc(accountId)}/chats`,
  );
  return data.items;
}

export async function listContacts(
  accountId: string,
  query?: string,
): Promise<WaContact[]> {
  const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const data = await api<{ items: WaContact[] }>(
    `/api/wa/accounts/${enc(accountId)}/contacts${q}`,
  );
  return data.items;
}

export async function getMessages(
  accountId: string,
  jid: string,
): Promise<WaMessage[]> {
  const data = await api<{ items: WaMessage[] }>(
    `/api/wa/accounts/${enc(accountId)}/messages?jid=${encodeURIComponent(jid)}`,
  );
  return data.items;
}

export async function searchMessages(
  accountId: string,
  query: string,
): Promise<WaMessage[]> {
  const data = await api<{ items: WaMessage[] }>(
    `/api/wa/accounts/${enc(accountId)}/search?q=${encodeURIComponent(query)}`,
  );
  return data.items;
}

export function sendText(
  accountId: string,
  jid: string,
  text: string,
): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/send`, {
    method: "POST",
    body: JSON.stringify({ jid, text }),
  });
}

export function sendMedia(
  accountId: string,
  input: {
    jid: string;
    type: "image" | "video" | "audio";
    data: string;
    caption?: string;
  },
): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/media`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function markRead(accountId: string, jid: string): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/read`, {
    method: "POST",
    body: JSON.stringify({ jid }),
  });
}

export function importSession(
  accountId: string,
  files: Record<string, string>,
): Promise<unknown> {
  return api(`/api/wa/accounts/${enc(accountId)}/session`, {
    method: "POST",
    body: JSON.stringify({ files }),
  });
}
