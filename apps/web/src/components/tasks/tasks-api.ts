import { API_URL } from "@/components/auth/auth-context";
import type {
  Actor,
  Attachment,
  KanbanList,
  KanbanTask,
} from "./tasks-data";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listActors(): Promise<Actor[]> {
  const data = await api<{ items: Actor[] }>("/api/actors");
  return data.items;
}

export async function listTaskLists(spaceId: string): Promise<KanbanList[]> {
  const data = await api<{ items: KanbanList[] }>(
    `/api/task-lists?spaceId=${spaceId}`,
  );
  return data.items;
}

export async function createTaskList(
  spaceId: string,
  name: string,
  position = 0,
): Promise<KanbanList> {
  return api<KanbanList>("/api/task-lists", {
    method: "POST",
    body: JSON.stringify({ spaceId, name, position }),
  });
}

export async function renameTaskList(id: string, name: string): Promise<KanbanList> {
  return api<KanbanList>(`/api/task-lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function reorderTaskList(id: string, position: number): Promise<KanbanList> {
  return api<KanbanList>(`/api/task-lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ position }),
  });
}

export async function deleteTaskList(id: string): Promise<void> {
  await api<void>(`/api/task-lists/${id}`, { method: "DELETE" });
}

export async function listTasks(spaceId: string): Promise<KanbanTask[]> {
  const data = await api<{ items: KanbanTask[] }>(`/api/tasks?spaceId=${spaceId}`);
  return data.items;
}

export async function createTask(input: {
  spaceId: string;
  listId: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  assigneeActorIds: string[];
  position?: number;
}): Promise<KanbanTask> {
  return api<KanbanTask>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<KanbanTask, "title" | "description" | "dueDate" | "listId" | "position" | "assigneeActorIds">>,
): Promise<KanbanTask> {
  return api<KanbanTask>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  const data = await api<{ items: Attachment[] }>(`/api/tasks/${taskId}/attachments`);
  return data.items;
}

export async function addAttachment(
  taskId: string,
  input: { name: string; mimeType: string; size: number; data: string },
): Promise<Attachment> {
  return api<Attachment>(`/api/tasks/${taskId}/attachments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteAttachment(taskId: string, attachmentId: string): Promise<void> {
  await api<void>(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
}
