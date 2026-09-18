"use client";

import { motion } from "framer-motion";
import {
  Bot,
  GitMerge,
  HeartPulse,
  Layers,
  User,
  UserPlus,
  Wrench,
} from "lucide-react";

import type { OrgNodeKind } from "@/lib/api-client";

export type ContextAction =
  | { type: "agent"; kind: OrgNodeKind }
  | { type: "human" }
  | { type: "team"; kind: OrgNodeKind }
  | { type: "heartbeat"; kind: OrgNodeKind }
  | { type: "tool"; kind: OrgNodeKind }
  | { type: "internal-app"; kind: OrgNodeKind }
  | { type: "connect" };

export interface ContextMenuState {
  x: number;
  y: number;
  /** The node the menu was opened on (null when opened on empty canvas). */
  nodeId: string | null;
}

const ITEMS: { action: ContextAction; icon: typeof Bot; label: string }[] = [
  { action: { type: "agent", kind: "agent" }, icon: Bot, label: "New Agent" },
  { action: { type: "human" }, icon: UserPlus, label: "Add Human" },
  { action: { type: "team", kind: "team" }, icon: Layers, label: "Create Team" },
  { action: { type: "heartbeat", kind: "heartbeat" }, icon: HeartPulse, label: "Create Heartbeat" },
  { action: { type: "tool", kind: "tool" }, icon: Wrench, label: "Add Tool / MCP" },
  { action: { type: "internal-app", kind: "tool" }, icon: User, label: "Add Internal App" },
  { action: { type: "connect" }, icon: GitMerge, label: "Connect Existing" },
];

export function ContextMenu({
  state,
  onSelect,
  onClose,
}: {
  state: ContextMenuState;
  onSelect: (action: ContextAction) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <motion.div
        className="absolute z-40 w-52 rounded-lg border border-border bg-card p-1 shadow-lg"
        style={{ left: state.x, top: state.y }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: "tween", duration: 0.1 }}
      >
        {ITEMS.map(({ action, icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            onClick={() => {
              onSelect(action);
              onClose();
            }}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {label}
          </button>
        ))}
      </motion.div>
    </>
  );
}