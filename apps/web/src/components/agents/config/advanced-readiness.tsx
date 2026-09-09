"use client";

import { ListChecks, Settings2 } from "lucide-react";

import { ConfigSection, TextField } from "./config-section";
import {
  computeReadiness,
  type AgentConfigState,
} from "./agent-config-types";

export function ReadinessSection({
  state,
}: {
  state: AgentConfigState;
}) {
  const items = computeReadiness(state);
  const score = Math.round(
    (items.filter((item) => item.met).length / items.length) * 100,
  );
  return (
    <ConfigSection
      title="Readiness"
      description="How ready this agent is to take on real work."
      icon={<ListChecks className="size-4" />}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-space-accent transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm font-semibold tabular-nums">
          {score}%
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-2 rounded-md border border-border px-3 py-2"
          >
            <span
              className={
                item.met
                  ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-600"
                  : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground"
              }
            >
              {item.met ? "✓" : "·"}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.detail}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

export function AdvancedSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  return (
    <ConfigSection
      title="Advanced"
      description="Technical configuration most users can leave alone."
      icon={<Settings2 className="size-4" />}
    >
      <TextField
        label="System prompt"
        textarea
        rows={5}
        value={state.systemPrompt}
        onChange={(systemPrompt) => onChange({ systemPrompt })}
        placeholder="Instructions the agent follows above all else…"
      />
    </ConfigSection>
  );
}