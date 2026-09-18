"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  Loader2,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTask,
  listActors,
  listTaskLists,
} from "@/components/tasks/tasks-api";
import type { Actor, KanbanList, KanbanTask } from "@/components/tasks/tasks-data";
import { useAppShell } from "@/components/app-shell/app-shell-context";

interface InChatTaskModalProps {
  open: boolean;
  onClose: () => void;
  contactName: string;
  contactJid: string;
  defaultTitle?: string;
  onTaskCreated?: (task: KanbanTask) => void;
}

export function InChatTaskModal({
  open,
  onClose,
  contactName,
  contactJid,
  defaultTitle = "",
  onTaskCreated,
}: InChatTaskModalProps) {
  const { space } = useAppShell();
  const spaceId = space.spaceId ?? space.id ?? "personal";

  const [title, setTitle] = useState(defaultTitle || `Follow up with ${contactName}`);
  const [description, setDescription] = useState(
    `Originated from WhatsApp conversation with ${contactName} (${contactJid}).`,
  );
  const [dueDate, setDueDate] = useState<string>("");
  const [listId, setListId] = useState<string | null>(null);
  const [assigneeActorIds, setAssigneeActorIds] = useState<string[]>([]);
  const [lists, setLists] = useState<KanbanList[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle || `Follow up with ${contactName}`);
    setDescription(
      `Originated from conversation with ${contactName} (${contactJid}).`,
    );
    setSuccess(false);

    let cancelled = false;
    setLoading(true);
    Promise.all([listTaskLists(spaceId), listActors()])
      .then(([fetchedLists, fetchedActors]) => {
        if (cancelled) return;
        setLists(fetchedLists);
        if (fetchedLists.length > 0) setListId(fetchedLists[0].id);
        setActors(fetchedActors);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, spaceId, contactName, contactJid, defaultTitle]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const newTask = await createTask({
        spaceId,
        listId: listId || (lists[0]?.id ?? null),
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeActorIds,
      });
      setSuccess(true);
      onTaskCreated?.(newTask);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      // Keep modal open on failure
    } finally {
      setSaving(false);
    }
  };

  const toggleAssignee = (actorId: string) => {
    setAssigneeActorIds((prev) =>
      prev.includes(actorId)
        ? prev.filter((id) => id !== actorId)
        : [...prev, actorId],
    );
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="glass-card glass-border relative w-full max-w-lg overflow-hidden rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <ListTodo className="size-4 text-space-accent" />
                <h3 className="font-display text-sm font-semibold">
                  Assign Task from Chat
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-space-accent" />
                Loading Task App context…
              </div>
            ) : success ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 className="size-8 text-emerald-500 animate-bounce" />
                <p className="text-sm font-medium">Task Assigned Successfully!</p>
                <p className="text-xs text-muted-foreground">
                  Saved to Kanban board & linked to {contactName}.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3.5">
                {/* Title */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Task Title
                  </label>
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Prepare quotation for Maria"
                    className="font-medium"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description & Context
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-xl border border-border/60 bg-card/80 p-2.5 text-xs outline-none focus:border-space-accent/40 focus:ring-2 focus:ring-space-accent/20 transition-all resize-none placeholder:text-muted-foreground"
                    placeholder="Add details, action items, or context..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Task List / Column */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Kanban List
                    </label>
                    <select
                      value={listId ?? ""}
                      onChange={(e) => setListId(e.target.value || null)}
                      className="h-9 rounded-xl border border-border/60 bg-card/80 px-2.5 text-xs outline-none"
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-space-accent" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-9 rounded-xl border border-border/60 bg-card/80 px-2.5 text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Assignees (Humans + Agents from Task App) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <User className="size-3 text-space-accent" />
                    Assignees (Human or AI Agent)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border border-border/40 rounded-2xl bg-card/40">
                    {actors.map((actor) => {
                      const selected = assigneeActorIds.includes(actor.id);
                      return (
                        <button
                          key={actor.id}
                          type="button"
                          onClick={() => toggleAssignee(actor.id)}
                          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs transition-all ${
                            selected
                              ? "bg-space-accent text-space-accent-foreground font-medium shadow-xs"
                              : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span className="text-[10px] opacity-70">
                            {actor.type === "agent" ? "🤖" : "👤"}
                          </span>
                          <span>{actor.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-space-accent text-space-accent-foreground hover:opacity-90 rounded-xl"
                    disabled={!title.trim() || saving}
                    onClick={() => void handleCreate()}
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Create & Assign Task
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
