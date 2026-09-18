export type AssigneeKind = "human" | "agent";

export interface Actor {
  id: string;
  type: AssigneeKind;
  displayName: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
}

export interface KanbanTask {
  id: string;
  listId: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  assigneeActorIds: string[];
  position: number;
}

export interface KanbanList {
  id: string;
  name: string;
}

export interface TaskDraft {
  title: string;
  description: string;
  dueDate: string | null;
  assigneeActorIds: string[];
}
