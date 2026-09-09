"use client";

import { useState } from "react";
import { KeyRound, Plus, X } from "lucide-react";

import { ConfigSection, ActionBadge } from "./config-section";
import { ACTION_OPTIONS, type AgentConfigState } from "./agent-config-types";
import type { AgentActionPermission } from "@/lib/api-client";

const PERMISSION_LEVELS: {
  value: AgentActionPermission;
  label: string;
  description: string;
}[] = [
  { value: "automatic", label: "Automatic", description: "Runs without asking." },
  { value: "approval", label: "Approval", description: "Pauses for approval." },
  { value: "never", label: "Never", description: "Always blocked." },
];

export function PermissionsSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const [draft, setDraft] = useState("");

  const setPermission = (action: string, level: AgentActionPermission) => {
    onChange({ actionPermissions: { ...state.actionPermissions, [action]: level } });
  };

  const removePermission = (action: string) => {
    const next = { ...state.actionPermissions };
    delete next[action];
    onChange({ actionPermissions: next });
  };

  const actions = Object.keys(state.actionPermissions);
  const suggested = ACTION_OPTIONS.filter((action) => !actions.includes(action));

  return (
    <ConfigSection
      title="Action permissions"
      description="Per-action guardrails. These decide whether a connected tool may be used and how."
      icon={<KeyRound className="size-4" />}
    >
      <div className="flex flex-col gap-3">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions configured yet. Add actions below and decide how the agent
            may act on each.
          </p>
        ) : (
          actions.map((action) => (
            <div
              key={action}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{action}</span>
                <button
                  type="button"
                  onClick={() => removePermission(action)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove ${action}`}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSION_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setPermission(action, level.value)}
                    className={
                      state.actionPermissions[action] === level.value
                        ? "flex items-center gap-1.5 rounded-lg border border-space-accent bg-space-accent/10 px-2.5 py-1 text-xs"
                        : "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    }
                  >
                    {level.label}
                    {state.actionPermissions[action] === level.value ? (
                      <ActionBadge action={level.value} />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {suggested.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            {suggested.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => setPermission(action, "approval")}
                className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-space-accent hover:text-foreground"
                title={`Add ${action}`}
              >
                <Plus className="size-3" />
                {action}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex items-center gap-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value) return;
            setPermission(value, "approval");
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a custom action (e.g. approve_expense)…"
            className="h-8 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>
    </ConfigSection>
  );
}