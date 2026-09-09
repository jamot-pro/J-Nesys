"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssigneeSelect } from "./AssigneeSelect";
import { addAttachment, deleteAttachment, listAttachments } from "./tasks-api";
import type { Actor, KanbanTask, TaskDraft } from "./tasks-data";

interface LocalAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
  persisted: boolean;
}

export interface TaskDetailProps {
  task: KanbanTask | null;
  actors: Actor[];
  onSave: (draft: TaskDraft) => Promise<KanbanTask>;
  onClose: () => void;
}

export function TaskDetail({ task, actors, onSave, onClose }: TaskDetailProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeActorIds ?? []);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (task) {
      void listAttachments(task.id).then((items) => {
        if (cancelled) return;
        setAttachments(
          items.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            data: a.data,
            persisted: true,
          })),
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [task]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          data: String(reader.result ?? ""),
          persisted: false,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (a: LocalAttachment) => {
    if (a.persisted) {
      setRemovedIds((prev) => [...prev, a.id]);
    }
    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
  };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const created = await onSave({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || null,
        assigneeActorIds: assigneeIds,
      });

      for (const a of attachments) {
        if (!a.persisted) {
          await addAttachment(created.id, {
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            data: a.data,
          });
        }
      }
      for (const id of removedIds) {
        await deleteAttachment(created.id, id);
      }
      onClose();
    } catch {
      // keep the modal open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-semibold">
            {task ? "Edit task" : "New task"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Input
            autoFocus
            placeholder="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Due date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Assign to
            </label>
            <AssigneeSelect
              actors={actors}
              value={assigneeIds}
              onChange={setAssigneeIds}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Attachments
            </label>
            <div className="flex flex-col gap-1.5">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm"
                >
                  {a.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.data}
                      alt={a.name}
                      className="size-8 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="size-4 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(a.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => removeAttachment(a)}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Paperclip className="size-4" />
                Attach a file
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!title.trim() || saving}>
            {saving ? "Saving…" : task ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
