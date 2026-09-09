"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { listTasks } from "@/components/tasks/tasks-api";
import type { KanbanTask } from "@/components/tasks/tasks-data";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import type { AutoActorMemory, ChatAgentSetting } from "./channel-types";

interface ChatContextDrawerProps {
  open: boolean;
  onClose: () => void;
  chatName: string;
  chatJid: string;
  isGroup?: boolean;
  actorMemory: AutoActorMemory;
  agentSetting?: ChatAgentSetting;
  onOpenTaskModal: () => void;
  onOpenAgentModal: () => void;
}

export function ChatContextDrawer({
  open,
  onClose,
  chatName,
  chatJid,
  isGroup = false,
  actorMemory,
  agentSetting,
  onOpenTaskModal,
  onOpenAgentModal,
}: ChatContextDrawerProps) {
  const { space } = useAppShell();
  const spaceId = space.spaceId ?? space.id ?? "personal";
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTasks(true);
    listTasks(spaceId)
      .then((items) => {
        if (cancelled) return;
        // Filter tasks related to this contact/chat
        const related = items.filter(
          (t) =>
            t.title.toLowerCase().includes(chatName.toLowerCase()) ||
            t.description.toLowerCase().includes(chatName.toLowerCase()) ||
            t.description.includes(chatJid),
        );
        setTasks(related);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, spaceId, chatName, chatJid]);

  if (!open) return null;

  return (
    <motion.aside
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="glass-card glass-border flex h-full w-84 shrink-0 flex-col overflow-hidden border-l border-border/40 bg-sidebar/80 shadow-2xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 px-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-space-accent" />
          <span className="font-display text-xs font-semibold tracking-wide uppercase text-foreground">
            Contact Intelligence & Memory
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5">
        {/* Persona Profile Card */}
        <div className="flex flex-col items-center rounded-2xl border border-border/40 bg-card/60 p-4 text-center shadow-xs">
          <Avatar name={chatName} size="lg" className="size-14 text-lg shadow-sm" />
          <h4 className="mt-2.5 font-display text-sm font-semibold text-foreground">
            {chatName}
          </h4>
          <p className="text-xs text-muted-foreground">{chatJid}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {isGroup ? "Group Chat" : "Direct Contact"}
            </Badge>
            <Badge variant="accent" className="text-[10px]">
              {actorMemory.sentiment} sentiment
            </Badge>
          </div>
        </div>

        {/* AI Auto-Reply Agent Card */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot className="size-3.5 text-space-accent" />
              <h5 className="text-xs font-semibold text-foreground">AI Auto-Reply</h5>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-space-accent hover:bg-space-accent/10"
              onClick={onOpenAgentModal}
            >
              <Settings className="size-3" />
              Configure
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2 text-xs">
            <span className="text-muted-foreground">Mode</span>
            <span className="font-medium capitalize text-foreground">
              {agentSetting?.autonomy === "autonomous"
                ? "⚡ Auto-Reply"
                : agentSetting?.autonomy === "draft"
                  ? "✍️ Copilot Draft"
                  : "🚫 Disabled"}
            </span>
          </div>

          {agentSetting?.agentName && agentSetting.autonomy !== "disabled" ? (
            <p className="text-[11px] text-muted-foreground">
              Assigned Agent: <span className="font-medium text-foreground">{agentSetting.agentName}</span>
            </p>
          ) : null}
        </section>

        {/* Auto-Aggregated Memory & Context (Jamot Spec §1.2 & §6) */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-space-accent" />
              <h5 className="text-xs font-semibold text-foreground">Auto-Derived Memory</h5>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {actorMemory.interactionCount} events
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="rounded-xl border-l-2 border-space-accent/40 bg-gradient-to-r from-space-accent/8 to-transparent p-2.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {actorMemory.contextSummary}
              </p>
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Key Insights
              </span>
              {actorMemory.memoryNotes.map((note, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-space-accent" />
                  <span className="text-[11px] leading-snug">{note}</span>
                </div>
              ))}
            </div>

            {actorMemory.preferences.length > 0 ? (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Preferences
                </span>
                {actorMemory.preferences.map((pref, i) => (
                  <Badge key={i} variant="secondary" className="w-fit text-[10px]">
                    {pref}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* Unified Tasks App Integration */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ListTodo className="size-3.5 text-space-accent" />
              <h5 className="text-xs font-semibold text-foreground">Tasks from Task App</h5>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-space-accent hover:bg-space-accent/10"
              onClick={onOpenTaskModal}
            >
              <Plus className="size-3" />
              Assign Task
            </Button>
          </div>

          {loadingTasks ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Loading tasks…
            </p>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                No active tasks linked to this contact.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-xl"
                onClick={onOpenTaskModal}
              >
                Create Task
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-1 rounded-xl border border-border/50 bg-card/80 p-2.5 text-xs shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{task.title}</span>
                    {task.dueDate ? (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-2.5" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  {task.description ? (
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.aside>
  );
}
