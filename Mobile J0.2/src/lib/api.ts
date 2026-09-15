import { getInitData } from "./telegram";
import type { MemoryEntry, Person, Task, TaskStatus } from "../types";

// Set VITE_API_URL to the jamot-api Render service origin (see render.yaml at
// the repo root for the deployed service name) for anything but local dev.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": getInitData(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface TelegramAuthResult {
  success: boolean;
  person: Person;
  actor: { id: string; displayName: string };
  reputation: { reputationStars: number; tierLevel: number };
}

export function authTelegram(): Promise<TelegramAuthResult> {
  return request<TelegramAuthResult>("/telegram/auth", { method: "POST" });
}

export function getPerson(id: string): Promise<Person> {
  return request<Person>(`/people/${id}`);
}

export function patchPerson(id: string, patch: Record<string, unknown>): Promise<Person> {
  return request<Person>(`/people/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function listTasksForActor(assigneeActorId: string): Promise<Task[]> {
  const { items } = await request<{ items: Task[] }>(
    `/tasks?assigneeActorId=${encodeURIComponent(assigneeActorId)}`,
  );
  return items;
}

export function patchTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return request<Task>(`/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function listPersonMemory(ownerId: string): Promise<MemoryEntry[]> {
  const { items } = await request<{ items: MemoryEntry[] }>(
    `/memory?scope=person&ownerId=${encodeURIComponent(ownerId)}`,
  );
  return items;
}

export function createPersonMemory(ownerId: string, text: string): Promise<MemoryEntry> {
  return request<MemoryEntry>("/memory", {
    method: "POST",
    body: JSON.stringify({
      scope: "person",
      ownerId,
      content: { text },
      provenance: { source: "self_declared" },
    }),
  });
}

export function deletePersonMemory(id: string): Promise<void> {
  return request<void>(`/memory/${id}`, { method: "DELETE" });
}
