"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { cn } from "@/lib/utils";
import { Card, Field, TextInput } from "@/components/settings/section-primitives";
import { createAgent } from "@/lib/api-client";
import type { AgentProfile } from "./agents-data";

type Autonomy = "suggest" | "approve" | "autonomous";

const AUTONOMY_OPTIONS: { value: Autonomy; label: string; description: string }[] = [
  { value: "suggest", label: "Suggest", description: "Only proposes, never acts." },
  { value: "approve", label: "Act with approval", description: "Acts after you approve." },
  { value: "autonomous", label: "Autonomous", description: "Acts on its own." },
];

const CHANNELS = ["WhatsApp", "Telegram", "Email", "Slack"] as const;

export function CreateAgent({
  onAdd,
  onCreated,
  onDone,
}: {
  onAdd?: (agent: AgentProfile) => void;
  onCreated?: (id: string) => void;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const { space } = useAppShell();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [autonomy, setAutonomy] = useState<Autonomy>("suggest");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [temperature, setTemperature] = useState("0.7");
  const [topP, setTopP] = useState("1.0");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    );
  };

  const addSkill = () => {
    const value = skillDraft.trim();
    if (!value) return;
    setSkills((prev) => [...prev, value]);
    setSkillDraft("");
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await createAgent({
        name: trimmed,
        ownerId: user.actor.id,
        role: purpose.trim() || "New agent",
        organizationIds:
          space.kind === "organization" && space.organizationId
            ? [space.organizationId]
            : [],
        autonomy,
      });
      if (onCreated) {
        onCreated(created.id);
        return;
      }
      onAdd?.({
        id: `agent-${Date.now()}`,
        name: trimmed,
        role: purpose.trim() || "New agent",
        availability: "available",
        autonomy,
        skills: skills.map((skill) => ({ name: skill, proficiency: 50 })),
        channels,
        reportsTo: "Main Manager",
        memory: { interactions: 0, notes: ["Just added to the agent directory."] },
        tasks: { active: 0 },
        reputation: { responsiveness: 50, reliability: 50, helpfulness: 50 },
      });
      onDone?.();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the agent.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Add an agent</h3>
        {onDone ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Close"
            onClick={onDone}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput
            placeholder="e.g. Travel planner"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label="What should it help with?">
          <textarea
            rows={3}
            placeholder="Describe the job in a sentence or two…"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <div>
          <span className="text-sm font-medium">Skills</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <TextInput
              placeholder="Add a skill…"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!skillDraft.trim()}
              onClick={addSkill}
            >
              <Plus className="size-4" />
              Add Skill
            </Button>
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">Channels</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CHANNELS.map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => toggleChannel(channel)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  channels.includes(channel)
                    ? "border-space-accent bg-space-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border text-[10px]",
                    channels.includes(channel)
                      ? "border-space-accent bg-space-accent text-space-accent-foreground"
                      : "border-border",
                  )}
                >
                  {channels.includes(channel) ? "✓" : ""}
                </span>
                {channel}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">Autonomy</span>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {AUTONOMY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAutonomy(option.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  autonomy === option.value
                    ? "border-space-accent bg-space-accent/10"
                    : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    autonomy === option.value
                      ? "border-space-accent"
                      : "border-border",
                  )}
                >
                  {autonomy === option.value ? (
                    <span className="size-2 rounded-full bg-space-accent" />
                  ) : null}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                advancedOpen && "rotate-180",
              )}
            />
            Advanced
          </button>
          {advancedOpen ? (
            <div className="mt-2 flex flex-col gap-4 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Temperature">
                  <TextInput
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                  />
                </Field>
                <Field label="Top P">
                  <TextInput
                    value={topP}
                    onChange={(event) => setTopP(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="System prompt">
                <textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!name.trim() || !user || submitting}
            onClick={() => void save()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
