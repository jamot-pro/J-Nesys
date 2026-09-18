"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  FileEdit,
  Power,
  Sparkles,
  Zap,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { AGENTS } from "@/components/agents/agents-data";
import type { AgentAutonomyMode, ChatAgentSetting } from "./channel-types";

interface ChatAgentConfigModalProps {
  open: boolean;
  onClose: () => void;
  chatName: string;
  chatJid: string;
  isGroup?: boolean;
  currentSetting?: ChatAgentSetting;
  onSaveSetting: (setting: ChatAgentSetting) => void;
}

export function ChatAgentConfigModal({
  open,
  onClose,
  chatName,
  chatJid,
  isGroup = false,
  currentSetting,
  onSaveSetting,
}: ChatAgentConfigModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    currentSetting?.agentId || AGENTS[0]?.id || "maria-assistant",
  );
  const [autonomy, setAutonomy] = useState<AgentAutonomyMode>(
    currentSetting?.autonomy || "autonomous",
  );
  const [customPrompt, setCustomPrompt] = useState(
    currentSetting?.customPrompt ||
      `Politely assist ${chatName}, answer questions using organizational knowledge, and draft follow-ups.`,
  );

  useEffect(() => {
    if (!open) return;
    setSelectedAgentId(currentSetting?.agentId || AGENTS[0]?.id || "maria-assistant");
    setAutonomy(currentSetting?.autonomy || "autonomous");
    setCustomPrompt(
      currentSetting?.customPrompt ||
        `Politely assist ${chatName}, answer questions using organizational knowledge, and draft follow-ups.`,
    );
  }, [open, currentSetting, chatName]);

  const handleSave = () => {
    const agent = AGENTS.find((a) => a.id === selectedAgentId);
    onSaveSetting({
      jid: chatJid,
      agentId: autonomy === "disabled" ? null : selectedAgentId,
      agentName: autonomy === "disabled" ? undefined : agent?.name,
      autonomy,
      customPrompt: customPrompt.trim(),
      enabledAt: new Date().toISOString(),
    });
    onClose();
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
                <Bot className="size-4 text-space-accent" />
                <div>
                  <h3 className="font-display text-sm font-semibold">
                    {isGroup ? "Group Auto-Reply Agent" : "Chat Auto-Reply Agent"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Assign an AI agent to monitor & respond to {chatName}
                  </p>
                </div>
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

            <div className="mt-4 flex flex-col gap-4">
              {/* Autonomy Mode Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Autonomy Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAutonomy("autonomous")}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all ${
                      autonomy === "autonomous"
                        ? "border-space-accent bg-space-accent/10 text-space-accent font-semibold shadow-xs"
                        : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <Zap className="size-4 text-emerald-500" />
                    <span className="text-xs">Auto-Reply</span>
                    <span className="text-[10px] opacity-70">Instant reply</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutonomy("draft")}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all ${
                      autonomy === "draft"
                        ? "border-space-accent bg-space-accent/10 text-space-accent font-semibold shadow-xs"
                        : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <FileEdit className="size-4 text-sky-500" />
                    <span className="text-xs">Copilot Draft</span>
                    <span className="text-[10px] opacity-70">Human approval</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutonomy("disabled")}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all ${
                      autonomy === "disabled"
                        ? "border-space-accent bg-space-accent/10 text-space-accent font-semibold shadow-xs"
                        : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <Power className="size-4 text-rose-500" />
                    <span className="text-xs">Disabled</span>
                    <span className="text-[10px] opacity-70">Manual only</span>
                  </button>
                </div>
              </div>

              {autonomy !== "disabled" ? (
                <>
                  {/* Select Agent */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Select Agent
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-border/40 rounded-2xl bg-card/40">
                      {AGENTS.map((agent) => {
                        const selected = selectedAgentId === agent.id;
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={`flex items-start gap-2 rounded-xl p-2 text-left transition-all ${
                              selected
                                ? "bg-space-accent/10 border border-space-accent/40 text-space-accent font-medium"
                                : "bg-card/70 hover:bg-muted/70 text-foreground border border-border/40"
                            }`}
                          >
                            <Bot className="size-4 shrink-0 text-space-accent mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">
                                {agent.name}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {agent.role}
                              </p>
                            </div>
                            {selected ? (
                              <Check className="size-3.5 text-space-accent shrink-0" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom System Prompt / Chat Instruction */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Sparkles className="size-3 text-space-accent" />
                      Chat-Specific Directives & Rules
                    </label>
                    <textarea
                      rows={3}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Always offer a meeting slot, answer technical questions accurately, never share internal pricing..."
                      className="rounded-xl border border-border/60 bg-card/80 p-2.5 text-xs outline-none focus:border-space-accent/40 focus:ring-2 focus:ring-space-accent/20 transition-all resize-none placeholder:text-muted-foreground"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                  AI auto-reply is disabled for this chat. Incoming messages will only be handled manually by humans.
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-space-accent text-space-accent-foreground hover:opacity-90 rounded-xl"
                  onClick={handleSave}
                >
                  Save Configuration
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
