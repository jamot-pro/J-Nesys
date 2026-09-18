"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bot, User } from "lucide-react";

import type { Actor, KanbanTask } from "./tasks-data";

export interface TaskCardProps {
  task: KanbanTask;
  actors: Record<string, Actor>;
  onOpen: (task: KanbanTask) => void;
}

export function TaskCard({ task, actors, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueLabel = due
    ? due.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      {task.description ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {dueLabel ? (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {dueLabel}
          </span>
        ) : null}

        <span className="ml-auto flex -space-x-1">
          {task.assigneeActorIds.slice(0, 3).map((id) => {
            const a = actors[id];
            if (!a) return null;
            const Icon = a.type === "agent" ? Bot : User;
            return (
              <span
                key={id}
                title={a.displayName}
                className="flex size-5 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
              >
                <Icon className="size-3" />
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}
