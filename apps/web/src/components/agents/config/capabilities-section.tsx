"use client";

import { useState } from "react";
import { Boxes, Cable, Database, Radio, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfigSection, Chip } from "./config-section";
import {
  MEMORY_SCOPE_OPTIONS,
  type AgentConfigState,
} from "./agent-config-types";
import type {
  ApiCapability,
  ApiConnector,
  ApiSkill,
} from "@/lib/api-client";

function PickerField({
  title,
  hint,
  options,
  selected,
  onToggle,
  freeform,
  freeLabel,
  freePlaceholder,
  onFreeAdd,
  onFreeRemove,
}: {
  title: string;
  hint: string;
  options: { id: string; label: string; meta?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  freeform?: boolean;
  freeLabel?: string;
  freePlaceholder?: string;
  onFreeAdd?: (value: string) => void;
  onFreeRemove?: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              className={
                active
                  ? "flex items-center gap-1.5 rounded-lg border border-space-accent bg-space-accent/10 px-2.5 py-1 text-xs"
                  : "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              <span>{option.label}</span>
              {option.meta ? (
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {option.meta}
                </span>
              ) : null}
            </button>
          );
        })}
        {freeform && selected
          ? selected
              .filter((value) => !options.some((option) => option.id === value))
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onFreeRemove?.(value)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs hover:border-destructive/50 hover:text-destructive"
                  title="Remove"
                >
                  {value} ×
                </button>
              ))
          : null}
      </div>
      {freeform ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value) return;
            onFreeAdd?.(value);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={freePlaceholder ?? "Add…"}
            className="h-8 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
          >
            {freeLabel ?? "Add"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function SkillsSection({
  skills,
  state,
  onChange,
}: {
  skills: ApiSkill[];
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (id: string) =>
    onChange({
      skillIds: state.skillIds.includes(id)
        ? state.skillIds.filter((value) => value !== id)
        : [...state.skillIds, id],
    });
  return (
    <ConfigSection
      title="Skills"
      description="What the agent knows how to do."
      icon={<Wand2 className="size-4" />}
    >
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No skills exist yet. Create one in the Skills app first.
        </p>
      ) : (
        <PickerField
          title="Assigned skills"
          hint={`${state.skillIds.length} assigned`}
          options={skills.map((skill) => ({
            id: skill.id,
            label: skill.name,
            meta: skill.status,
          }))}
          selected={state.skillIds}
          onToggle={toggle}
        />
      )}
    </ConfigSection>
  );
}

export function CapabilitiesSection({
  capabilities,
  state,
  onChange,
}: {
  capabilities: ApiCapability[];
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (id: string) =>
    onChange({
      capabilityIds: state.capabilityIds.includes(id)
        ? state.capabilityIds.filter((value) => value !== id)
        : [...state.capabilityIds, id],
    });
  return (
    <ConfigSection
      title="Capabilities"
      description="Fine-grained capability grants for this agent."
      icon={<Boxes className="size-4" />}
    >
      {capabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No capabilities defined yet.
        </p>
      ) : (
        <PickerField
          title="Assigned capabilities"
          hint={`${state.capabilityIds.length} assigned`}
          options={capabilities.map((capability) => ({
            id: capability.id,
            label: capability.name,
          }))}
          selected={state.capabilityIds}
          onToggle={toggle}
        />
      )}
    </ConfigSection>
  );
}

export function ConnectionsSection({
  connectors,
  state,
  onChange,
}: {
  connectors: ApiConnector[];
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (id: string) =>
    onChange({
      connectorIds: state.connectorIds.includes(id)
        ? state.connectorIds.filter((value) => value !== id)
        : [...state.connectorIds, id],
    });
  return (
    <ConfigSection
      title="Connections"
      description="Tools the agent can reach. Connection is not permission — pair with action permissions below."
      icon={<Cable className="size-4" />}
    >
      {connectors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No connectors available. Add one in the Vault first.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => {
            const active = state.connectorIds.includes(connector.id);
            return (
              <button
                key={connector.id}
                type="button"
                onClick={() => toggle(connector.id)}
                className={
                  active
                    ? "flex items-center gap-1.5 rounded-lg border border-space-accent bg-space-accent/10 px-2.5 py-1 text-xs"
                    : "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                }
              >
                <span>{connector.provider}</span>
                {connector.status === "connected" ? (
                  <Badge variant="secondary" className="px-1.5 text-[10px]">
                    connected
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </ConfigSection>
  );
}

export function MemoryScopesSection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (value: string) =>
    onChange({
      memoryScopes: state.memoryScopes.includes(value)
        ? state.memoryScopes.filter((item) => item !== value)
        : [...state.memoryScopes, value],
    });
  return (
    <ConfigSection
      title="Memory scopes"
      description="Which parts of the workspace memory this agent may read and write."
      icon={<Database className="size-4" />}
    >
      <div className="flex flex-wrap gap-2">
        {MEMORY_SCOPE_OPTIONS.map((scope) => (
          <Chip
            key={scope}
            selected={state.memoryScopes.includes(scope)}
            onClick={() => toggle(scope)}
          >
            {scope}
          </Chip>
        ))}
        {state.memoryScopes
          .filter((scope) => !MEMORY_SCOPE_OPTIONS.includes(scope as (typeof MEMORY_SCOPE_OPTIONS)[number]))
          .map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => toggle(scope)}
              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs hover:text-destructive"
              title="Remove"
            >
              {scope} ×
            </button>
          ))}
      </div>
    </ConfigSection>
  );
}

export function SubscribedEventsSection({
  knownEvents,
  state,
  onChange,
}: {
  knownEvents: readonly string[];
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (value: string) =>
    onChange({
      subscribedEvents: state.subscribedEvents.includes(value)
        ? state.subscribedEvents.filter((item) => item !== value)
        : [...state.subscribedEvents, value],
    });
  const addCustom = (value: string) =>
    onChange({
      subscribedEvents: state.subscribedEvents.includes(value)
        ? state.subscribedEvents
        : [...state.subscribedEvents, value],
    });
  const removeCustom = (value: string) =>
    onChange({
      subscribedEvents: state.subscribedEvents.filter((item) => item !== value),
    });
  return (
    <ConfigSection
      title="Subscribed events"
      description="Events that wake this agent so it can react."
      icon={<Radio className="size-4" />}
    >
      <div className="flex flex-wrap gap-2">
        {knownEvents.map((event) => (
          <Chip
            key={event}
            selected={state.subscribedEvents.includes(event)}
            onClick={() => toggle(event)}
          >
            {event}
          </Chip>
        ))}
        {state.subscribedEvents
          .filter((event) => !knownEvents.includes(event))
          .map((event) => (
            <button
              key={event}
              type="button"
              onClick={() => removeCustom(event)}
              className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs hover:text-destructive"
              title="Remove"
            >
              {event} ×
            </button>
          ))}
      </div>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem(
            "custom-event",
          ) as HTMLInputElement | null;
          if (!input) return;
          const value = input.value.trim();
          if (!value) return;
          addCustom(value);
          input.value = "";
        }}
      >
        <input
          name="custom-event"
          placeholder="Add a custom event (e.g. invoice.overdue)…"
          className="h-8 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          Add
        </button>
      </form>
    </ConfigSection>
  );
}