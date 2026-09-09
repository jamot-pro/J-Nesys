"use client";

import { Cpu, Fingerprint, Gauge, ShieldCheck, Users } from "lucide-react";

import { ConfigSection, Segmented, TextField } from "./config-section";
import type { AgentConfigState } from "./agent-config-types";
import type { ApiAgent, OrganizationListItem } from "@/lib/api-client";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { Card, Field } from "@/components/settings/section-primitives";
import { ModelPicker } from "@/components/settings/model-picker";

export function IdentitySection({
  agent,
  state,
  onChange,
}: {
  agent: ApiAgent;
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  return (
    <ConfigSection
      title="Identity"
      description="Who this agent is and what it is here for."
      icon={<Fingerprint className="size-4" />}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Name</span>
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            {agent.role ?? agent.purpose ?? "Agent"}
          </p>
          <span className="text-xs text-muted-foreground">
            The agent’s display name is set by its actor.
          </span>
        </div>
        <TextField
          label="Role"
          value={state.role}
          onChange={(role) => onChange({ role })}
          placeholder="e.g. Customer Relationship Agent"
        />
        <TextField
          label="Purpose"
          textarea
          rows={2}
          value={state.purpose}
          onChange={(purpose) => onChange({ purpose })}
          placeholder="One sentence: what should it help with?"
        />
        <TextField
          label="Description"
          textarea
          rows={2}
          value={state.description}
          onChange={(description) => onChange({ description })}
          placeholder="Optional longer description…"
        />
      </div>
    </ConfigSection>
  );
}

const AUTONOMY_OPTIONS: {
  value: AgentConfigState["autonomy"];
  label: string;
  description: string;
}[] = [
  {
    value: "suggest",
    label: "Suggest",
    description: "Only proposes options, never acts.",
  },
  {
    value: "approve",
    label: "Act with approval",
    description: "Acts once you approve each step.",
  },
  {
    value: "autonomous",
    label: "Autonomous",
    description: "Acts on its own within its permission budget.",
  },
];

const AVAILABILITY_OPTIONS: {
  value: AgentConfigState["availability"];
  label: string;
  description: string;
}[] = [
  { value: "available", label: "Available", description: "Ready to take on work." },
  { value: "busy", label: "Busy", description: "Working through a backlog." },
  { value: "offline", label: "Offline", description: "Not accepting work." },
];

export function AutonomySection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  return (
    <ConfigSection
      title="Autonomy"
      description="How much the agent may do without asking first."
      icon={<ShieldCheck className="size-4" />}
    >
      <Segmented
        options={AUTONOMY_OPTIONS}
        value={state.autonomy}
        onChange={(autonomy) => onChange({ autonomy })}
      />
    </ConfigSection>
  );
}

export function AvailabilitySection({
  state,
  onChange,
}: {
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  return (
    <ConfigSection
      title="Availability"
      description="Whether the agent accepts new work right now."
      icon={<Gauge className="size-4" />}
    >
      <Segmented
        options={AVAILABILITY_OPTIONS}
        value={state.availability}
        onChange={(availability) => onChange({ availability })}
      />
    </ConfigSection>
  );
}

export function OrganizationsSection({
  organizations,
  state,
  onChange,
}: {
  organizations: OrganizationListItem[];
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const toggle = (id: string) => {
    onChange({
      organizationIds: state.organizationIds.includes(id)
        ? state.organizationIds.filter((value) => value !== id)
        : [...state.organizationIds, id],
    });
  };
  return (
    <ConfigSection
      title="Organizations"
      description="Deploy this agent to organizations. Membership is not permission."
      icon={<Users className="size-4" />}
    >
      {organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No organizations available to assign.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {organizations.map((item) => (
            <button
              key={item.organization.id}
              type="button"
              onClick={() => toggle(item.organization.id)}
              className={
                state.organizationIds.includes(item.organization.id)
                  ? "rounded-lg border border-space-accent bg-space-accent/10 px-3 py-1.5 text-sm"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {item.space.name}
            </button>
          ))}
        </div>
      )}
    </ConfigSection>
  );
}

export function ModelSection({
  agent,
  state,
  onChange,
}: {
  agent: ApiAgent;
  state: AgentConfigState;
  onChange: (patch: Partial<AgentConfigState>) => void;
}) {
  const { space } = useAppShell();
  const organizationId =
    agent.organizationIds[0] ?? space.organizationId ?? null;

  return (
    <ConfigSection
      title="Model"
      description="Which configured model this agent uses when running."
      icon={<Cpu className="size-4" />}
    >
      <Card>
        <Field label="Assigned model">
          <ModelPicker
            organizationId={organizationId}
            value={state.model}
            onChange={(v) => onChange({ model: v })}
          />
        </Field>
      </Card>
    </ConfigSection>
  );
}
