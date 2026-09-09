"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOutreachCampaign,
  getAgents,
  listOutreachLists,
  type OutreachChannel,
} from "@/lib/api-client";

interface StepDraft {
  key: string;
  sendAfterDays: number;
  channel: OutreachChannel;
  subject: string;
  template: string;
  instructions: string;
}

const CHANNELS: { value: OutreachChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "matrix", label: "Matrix" },
  { value: "web", label: "Web" },
];

const emptyStep = (): StepDraft => ({
  key: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sendAfterDays: 0,
  channel: "whatsapp",
  subject: "",
  template: "",
  instructions: "",
});

export function CreateCampaign({
  spaceId,
  orgId,
  onCreated,
  onDone,
}: {
  spaceId: string;
  orgId: string | undefined;
  onCreated: (id: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);

  const [lists, setLists] = useState<Awaited<ReturnType<typeof listOutreachLists>>>([]);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof getAgents>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOutreachLists(spaceId), getAgents()])
      .then(([lists, agents]) => {
        if (cancelled) return;
        const visibleAgents = orgId
          ? agents.filter((agent) => agent.organizationIds.includes(orgId))
          : agents;
        setLists(lists);
        setAgents(visibleAgents);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load lists or agents");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, orgId]);

  const canSubmit =
    name.trim() !== "" &&
    goal.trim() !== "" &&
    listId !== "" &&
    agentId !== "" &&
    steps.some((s) => s.template.trim() !== "" || s.instructions.trim() !== "");

  const updateStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((prev) =>
      prev.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const campaign = await createOutreachCampaign({
        spaceId,
        name: name.trim(),
        goal: goal.trim(),
        description: description.trim(),
        listId,
        agentId,
        steps: steps.map((step, index) => ({
          position: index,
          sendAfterDays: step.sendAfterDays,
          channel: step.channel,
          subject: step.subject,
          template: step.template,
          instructions: step.instructions,
        })),
      });
      onCreated(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-semibold">New outreach campaign</h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Close"
          onClick={onDone}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 demo outreach"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Goal for the agent
          </label>
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Book a 30-minute demo call"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Source list (People)
          </label>
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Select a list…</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.memberPersonIds.length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Assigned agent
          </label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Select an agent…</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.role ?? agent.purpose ?? "Agent"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context for the campaign"
            className="min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Sequence
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSteps((prev) => [...prev, emptyStep()])}
            >
              <Plus className="size-3.5" /> Add step
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {steps.map((step, index) => (
              <div
                key={step.key}
                className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Step {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Remove step"
                    disabled={steps.length === 1}
                    onClick={() =>
                      setSteps((prev) =>
                        prev.length === 1 ? prev : prev.filter((s) => s.key !== step.key),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={step.sendAfterDays}
                      onChange={(e) =>
                        updateStep(step.key, {
                          sendAfterDays: Number(e.target.value),
                        })
                      }
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                  <select
                    value={step.channel}
                    onChange={(e) =>
                      updateStep(step.key, {
                        channel: e.target.value as OutreachChannel,
                      })
                    }
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {CHANNELS.map((channel) => (
                      <option key={channel.value} value={channel.value}>
                        {channel.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  value={step.subject}
                  onChange={(e) => updateStep(step.key, { subject: e.target.value })}
                  placeholder="Subject (optional)"
                  className="h-8 text-sm"
                />

                <textarea
                  value={step.template}
                  onChange={(e) => updateStep(step.key, { template: e.target.value })}
                  placeholder="Message template (agent personalizes this)"
                  className="min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                />

                <textarea
                  value={step.instructions}
                  onChange={(e) =>
                    updateStep(step.key, { instructions: e.target.value })
                  }
                  placeholder="Agent instructions for this step (optional)"
                  className="min-h-[50px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || saving}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Create campaign
          </Button>
        </div>
      </div>
    </div>
  );
}