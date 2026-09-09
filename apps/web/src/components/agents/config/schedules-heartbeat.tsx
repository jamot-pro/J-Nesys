"use client";

import { CalendarClock, Clock3, Plus, Trash2, Wallet } from "lucide-react";

import { ConfigSection, Chip, Segmented, TextField, ToggleRow } from "./config-section";
import {
  HEARTBEAT_CHECK_OPTIONS,
  isCronValid,
  isQuietHoursValid,
  newScheduleId,
  type AgentConfigState,
} from "./agent-config-types";
import type { ApiAgentSchedule } from "@/lib/api-client";

export function SchedulesSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const addSchedule = () => {
    onChange({
      schedules: [
        ...state.schedules,
        {
          id: newScheduleId(),
          enabled: true,
          cron: "0 9 * * *",
          prompt: "",
        },
      ],
    });
  };
  const updateSchedule = (id: string, patch: Partial<ApiAgentSchedule>) => {
    onChange({
      schedules: state.schedules.map((schedule) =>
        schedule.id === id ? { ...schedule, ...patch } : schedule,
      ),
    });
  };
  const removeSchedule = (id: string) => {
    onChange({ schedules: state.schedules.filter((schedule) => schedule.id !== id) });
  };

  return (
    <ConfigSection
      title="Scheduled tasks"
      description="Deterministic tasks the agent runs on a schedule, separate from its heartbeat."
      icon={<CalendarClock className="size-4" />}
    >
      <div className="flex flex-col gap-3">
        {state.schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scheduled tasks yet.
          </p>
        ) : (
          state.schedules.map((schedule) => {
            const valid = isCronValid(schedule.cron);
            return (
              <div
                key={schedule.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm">{schedule.cron}</span>
                  <div className="flex items-center gap-2">
                    <ToggleRow
                      label="Enabled"
                      checked={schedule.enabled}
                      onChange={(enabled) => updateSchedule(schedule.id, { enabled })}
                    />
                    <button
                      type="button"
                      onClick={() => removeSchedule(schedule.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove schedule"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                {!valid ? (
                  <p className="text-xs text-destructive">
                    Invalid cron expression — use 5 fields (e.g. &quot;0 9 * * 1-5&quot;).
                  </p>
                ) : null}
                <TextField
                  label="What to do"
                  textarea
                  rows={2}
                  value={schedule.prompt}
                  onChange={(prompt) => updateSchedule(schedule.id, { prompt })}
                  placeholder="Describe what the agent should do when this fires…"
                />
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={addSchedule}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-space-accent hover:text-foreground"
        >
          <Plus className="size-4" />
          Add a scheduled task
        </button>
      </div>
    </ConfigSection>
  );
}

const ON_ACTION_OPTIONS: {
  value: AgentConfigState["heartbeat"]["onAction"];
  label: string;
  description: string;
}[] = [
  { value: "act", label: "Act", description: "Handle it directly." },
  { value: "ask", label: "Ask", description: "Surface it and ask." },
  { value: "notify", label: "Notify", description: "Notify without acting." },
];

export function HeartbeatSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const heartbeat = state.heartbeat;
  const setHeartbeat = (patch: Partial<AgentConfigState["heartbeat"]>) => {
    onChange({ heartbeat: { ...heartbeat, ...patch } });
  };
  const toggleCheck = (scope: string) =>
    setHeartbeat({
      check: heartbeat.check.includes(scope)
        ? heartbeat.check.filter((value) => value !== scope)
        : [...heartbeat.check, scope],
    });
  const cronValid = isCronValid(heartbeat.cron ?? "");
  const quietValid = isQuietHoursValid(heartbeat.quietHours ?? "");

  return (
    <ConfigSection
      title="Heartbeat / proactive mode"
      description="When idle, the agent wakes on this schedule, inspects the listed scopes, and decides what to do."
      icon={<Clock3 className="size-4" />}
    >
      <div className="flex flex-col gap-3">
        <ToggleRow
          label="Enabled"
          description="Wake the agent on a recurring schedule."
          checked={heartbeat.enabled}
          onChange={(enabled) => setHeartbeat({ enabled })}
        />

        {heartbeat.enabled ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Cron schedule"
                hint="5-field cron. Leave empty for every minute."
                value={heartbeat.cron ?? ""}
                onChange={(cron) => setHeartbeat({ cron: cron || null })}
                placeholder="*/15 * * * *"
              />
              <TextField
                label="Quiet hours"
                hint='Range like "22:00-07:00". Optional.'
                value={heartbeat.quietHours ?? ""}
                onChange={(quietHours) => setHeartbeat({ quietHours: quietHours || null })}
                placeholder="22:00-07:00"
              />
            </div>
            {heartbeat.cron && !cronValid ? (
<p className="text-xs text-destructive">
                  Invalid cron expression — use 5 fields (e.g. &quot;*/15 * * * *&quot;).
                </p>
            ) : null}
            {heartbeat.quietHours && !quietValid ? (
<p className="text-xs text-destructive">
                Quiet hours must look like &quot;HH:MM-HH:MM&quot; (e.g. &quot;22:00-07:00&quot;).
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                Check these on each wake-up
              </span>
              <div className="flex flex-wrap gap-2">
                {HEARTBEAT_CHECK_OPTIONS.map((scope) => (
                  <Chip
                    key={scope}
                    selected={heartbeat.check.includes(scope)}
                    onClick={() => toggleCheck(scope)}
                  >
                    {scope}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">When something needs attention</span>
              <Segmented
                options={ON_ACTION_OPTIONS}
                value={heartbeat.onAction}
                onChange={(onAction) => setHeartbeat({ onAction })}
              />
            </div>
          </>
        ) : null}
      </div>
    </ConfigSection>
  );
}

export function BudgetSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  return (
    <ConfigSection
      title="Budget"
      description="Optional spending ceiling the agent respects across its actions."
      icon={<Wallet className="size-4" />}
    >
      <TextField
        label="Monthly budget"
        hint="Leave empty for no cap."
        value={state.budget}
        onChange={(budget) => onChange({ budget: budget.replace(/[^0-9.]/g, "") })}
        placeholder="e.g. 500"
      />
    </ConfigSection>
  );
}