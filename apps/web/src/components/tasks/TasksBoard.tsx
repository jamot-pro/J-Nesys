"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-context";
import { TaskCard } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import {
  createTask,
  createTaskList,
  deleteTaskList,
  listActors,
  listTaskLists,
  listTasks,
  renameTaskList,
  reorderTaskList,
  updateTask,
} from "./tasks-api";
import type { Actor, KanbanList, KanbanTask, TaskDraft } from "./tasks-data";

export function TasksBoard() {
  const { user } = useAuth();
  const { space } = useAppShell();
  const spaceId = space.spaceId ?? user?.person?.membershipSpaceIds[0] ?? null;

  const [actors, setActors] = useState<Actor[]>([]);
  const [lists, setLists] = useState<KanbanList[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [creatingInList, setCreatingInList] = useState<string | null>(null);
  const [renamingList, setRenamingList] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const actorsById = useMemo(() => {
    const map: Record<string, Actor> = {};
    for (const a of actors) map[a.id] = a;
    return map;
  }, [actors]);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const [actorList, listData, taskData] = await Promise.all([
          listActors(),
          listTaskLists(spaceId),
          listTasks(spaceId),
        ]);
        if (cancelled) return;
        setActors(actorList);
        setLists(listData);
        setTasks(taskData);
      } catch {
        // leave empty on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const tasksFor = (listId: string) => tasks.filter((t) => t.listId === listId);

  const listIdOf = (id: string): string | undefined => {
    if (lists.some((l) => l.id === id)) return id;
    return tasks.find((t) => t.id === id)?.listId ?? undefined;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (lists.some((l) => l.id === activeId)) {
      const from = lists.findIndex((l) => l.id === activeId);
      const to = lists.findIndex((l) => l.id === overId);
      if (from === -1 || to === -1) return;
      setLists((prev) => arrayMove(prev, from, to));
      void reorderTaskList(activeId, to).catch(() => {});
      return;
    }

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const targetList = listIdOf(overId);
    if (!targetList) return;

    const listTasks = tasks.filter((t) => t.listId === targetList);
    const others = tasks.filter((t) => t.listId !== targetList);

    let reordered: KanbanTask[];
    if (activeTask.listId === targetList) {
      const from = listTasks.findIndex((t) => t.id === activeId);
      const to = listTasks.findIndex((t) => t.id === overId);
      if (from === -1 || to === -1) return;
      reordered = arrayMove(listTasks, from, to);
    } else {
      const overIndex = listTasks.findIndex((t) => t.id === overId);
      const moved = { ...activeTask, listId: targetList };
      reordered =
        overIndex === -1
          ? [...listTasks, moved]
          : [...listTasks.slice(0, overIndex), moved, ...listTasks.slice(overIndex)];
    }

    setTasks([...others, ...reordered]);
    const newIndex = reordered.findIndex((t) => t.id === activeId);
    void updateTask(activeId, {
      listId: targetList,
      position: newIndex,
    }).catch(() => {});
  };

  const addList = async () => {
    if (!spaceId) return;
    const name = nameDraft.trim();
    if (!name) return;
    try {
      const list = await createTaskList(spaceId, name, lists.length);
      setLists((prev) => [...prev, list]);
      setNameDraft("");
    } catch {
      // ignore
    }
  };

  const commitRenameList = (id: string, name: string) => {
    const next = name.trim();
    if (next) {
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: next } : l)));
      void renameTaskList(id, next).catch(() => {});
    }
    setRenamingList(null);
  };

  const removeList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    setTasks((prev) => prev.filter((t) => t.listId !== id));
    void deleteTaskList(id).catch(() => {});
  };

  const onCreateTask = async (listId: string, draft: TaskDraft): Promise<KanbanTask> => {
    if (!spaceId) throw new Error("no space");
    const task = await createTask({
      spaceId,
      listId,
      title: draft.title,
      description: draft.description,
      dueDate: draft.dueDate,
      assigneeActorIds: draft.assigneeActorIds,
      position: tasksFor(listId).length,
    });
    setTasks((prev) => [...prev, task]);
    return task;
  };

  const onUpdateTask = async (id: string, draft: TaskDraft): Promise<KanbanTask> => {
    const task = await updateTask(id, {
      title: draft.title,
      description: draft.description,
      dueDate: draft.dueDate,
      assigneeActorIds: draft.assigneeActorIds,
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    return task;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="font-display text-sm font-semibold">Tasks</span>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lists.map((l) => l.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex h-full items-start gap-3 p-4">
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  tasks={tasksFor(list.id)}
                  actors={actorsById}
                  renaming={renamingList === list.id}
                  nameDraft={nameDraft}
                  onNameDraft={setNameDraft}
                  onStartRename={() => {
                    setRenamingList(list.id);
                    setNameDraft(list.name);
                  }}
                  onCommitRename={(name) => commitRenameList(list.id, name)}
                  onDelete={() => removeList(list.id)}
                  onAddCard={() => setCreatingInList(list.id)}
                  onOpenTask={setEditingTask}
                />
              ))}

              <div className="w-72 shrink-0">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2">
                  <Input
                    placeholder="Add list…"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addList()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Add list"
                    onClick={() => void addList()}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {editingTask ? (
        <TaskDetail
          task={editingTask}
          actors={actors}
          onSave={(draft) => onUpdateTask(editingTask.id, draft)}
          onClose={() => setEditingTask(null)}
        />
      ) : null}

      {creatingInList ? (
        <TaskDetail
          task={null}
          actors={actors}
          onSave={(draft) => onCreateTask(creatingInList, draft)}
          onClose={() => setCreatingInList(null)}
        />
      ) : null}
    </div>
  );
}

interface ListColumnProps {
  list: KanbanList;
  tasks: KanbanTask[];
  actors: Record<string, Actor>;
  renaming: boolean;
  nameDraft: string;
  onNameDraft: (v: string) => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onDelete: () => void;
  onAddCard: () => void;
  onOpenTask: (task: KanbanTask) => void;
}

function ListColumn({
  list,
  tasks,
  actors,
  renaming,
  nameDraft,
  onNameDraft,
  onStartRename,
  onCommitRename,
  onDelete,
  onAddCard,
  onOpenTask,
}: ListColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40"
    >
      <div
        {...attributes}
        {...listeners}
        className="group flex h-10 shrink-0 cursor-grab items-center gap-2 border-b border-border px-3"
      >
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => onNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename(nameDraft);
              if (e.key === "Escape") onCommitRename(list.name);
            }}
            onBlur={() => onCommitRename(nameDraft)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={onStartRename}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
          >
            {list.name}
          </button>
        )}
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        <button
          type="button"
          aria-label={`Delete ${list.name}`}
          onClick={onDelete}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} actors={actors} onOpen={onOpenTask} />
          ))}
        </div>
      </SortableContext>

      <div className="shrink-0 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onAddCard}
        >
          <Plus className="size-4" />
          Add card
        </Button>
      </div>
    </div>
  );
}
