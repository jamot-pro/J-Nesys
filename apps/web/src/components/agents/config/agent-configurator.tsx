"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, ExternalLink, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveBar } from "./config-section";
import { IdentitySection, AutonomySection, AvailabilitySection, OrganizationsSection, ModelSection } from "./identity-autonomy";
import { SkillsSection, CapabilitiesSection, ConnectionsSection, MemoryScopesSection, SubscribedEventsSection } from "./capabilities-section";
import { PermissionsSection } from "./permissions-section";
import { SchedulesSection, HeartbeatSection, BudgetSection } from "./schedules-heartbeat";
import { ReadinessSection, AdvancedSection } from "./advanced-readiness";
import { RelationshipsSection, ActivitySection } from "./relationships-activity";
import {
  buildUpdateBody,
  KNOWN_EVENT_TYPES,
  stateFromAgent,
  type AgentConfigState,
} from "./agent-config-types";
import {
  deleteAgent,
  getAgent,
  getOrganizations,
  listActors,
  listCapabilities,
  listConnectors,
  listSkills,
  updateAgent,
  type ApiAgent,
  type ApiActor,
  type ApiCapability,
  type ApiConnector,
  type ApiSkill,
  type OrganizationListItem,
} from "@/lib/api-client";
import { useAppShell } from "@/components/app-shell/app-shell-context";

export function AgentConfigurator({
  agentId,
  onBack,
  onDeleted,
}: {
  agentId: string;
  onBack?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const { space } = useAppShell();

  const [agent, setAgent] = useState<ApiAgent | null>(null);
  const [actors, setActors] = useState<ApiActor[]>([]);
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [capabilities, setCapabilities] = useState<ApiCapability[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [state, setState] = useState<AgentConfigState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const orgId = space.kind === "organization" ? space.organizationId : undefined;
    Promise.all([
      getAgent(agentId),
      listActors(),
      listConnectors(orgId),
      listSkills(orgId),
      listCapabilities(),
      getOrganizations(),
    ])
      .then(([loadedAgent, loadedActors, loadedConnectors, loadedSkills, loadedCapabilities, loadedOrgs]) => {
        if (cancelled) return;
        setAgent(loadedAgent);
        setActors(loadedActors);
        setConnectors(loadedConnectors);
        setSkills(loadedSkills);
        setCapabilities(loadedCapabilities);
        setOrganizations(loadedOrgs);
        setState(stateFromAgent(loadedAgent));
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : "Could not load this agent.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, space.id]);

  const dirty = useMemo(() => {
    if (!agent || !state) return false;
    return Object.keys(buildUpdateBody(agent, state)).length > 0;
  }, [agent, state]);

  const actor = agent ? (actors.find((item) => item.id === agent.actorId) ?? null) : null;
  const displayName = actor?.displayName ?? agent?.role ?? agent?.purpose ?? "Agent";

  const onChange = (patch: Partial<AgentConfigState>) => {
    setSaved(false);
    setError(null);
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    if (!agent || !state || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = buildUpdateBody(agent, state);
      if (Object.keys(body).length === 0) {
        setSaved(true);
        return;
      }
      const updated = await updateAgent(agent.id, body);
      setAgent(updated);
      setState(stateFromAgent(updated));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAgent(agent.id);
      if (onDeleted) {
        onDeleted();
        return;
      }
      router.push("/agents");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the agent.");
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        Loading agent…
      </div>
    );
  }

  if (loadError || !agent || !state) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Bot className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {loadError ?? "This agent could not be found."}
        </p>
        <Link
          href="/agents"
          className="text-sm font-medium text-space-accent hover:underline"
        >
          Back to agents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 pb-24">
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to directory
            </button>
          ) : (
            <Link
              href="/agents"
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to agents
            </Link>
          )}
          {onBack ? (
            <Link
              href={`/agents/${agent.id}`}
              className="flex items-center gap-1.5 text-xs font-medium text-space-accent hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Open in full page
            </Link>
          ) : null}
        </div>

        <header className="flex items-start gap-4">
          <Avatar name={displayName} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant="accent" className="gap-1">
                <Bot className="size-3" />
                Agent
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={
                    agent.availability === "available"
                      ? "size-2 rounded-full bg-emerald-500"
                      : agent.availability === "busy"
                        ? "size-2 rounded-full bg-amber-500"
                        : "size-2 rounded-full bg-zinc-400"
                  }
                  aria-hidden
                />
                {agent.availability}
              </span>
            </div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {agent.role ?? agent.purpose ?? "Configure this agent"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {confirmingDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  {saving ? "Deleting…" : "Confirm delete"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-4">
            <IdentitySection agent={agent} state={state} onChange={onChange} />
            <ModelSection agent={agent} state={state} onChange={onChange} />
            <AutonomySection state={state} onChange={onChange} />
            <AvailabilitySection state={state} onChange={onChange} />
            <OrganizationsSection
              organizations={organizations}
              state={state}
              onChange={onChange}
            />
            <SkillsSection skills={skills} state={state} onChange={onChange} />
            <CapabilitiesSection
              capabilities={capabilities}
              state={state}
              onChange={onChange}
            />
            <ConnectionsSection
              connectors={connectors}
              state={state}
              onChange={onChange}
            />
            <PermissionsSection state={state} onChange={onChange} />
            <MemoryScopesSection state={state} onChange={onChange} />
            <SubscribedEventsSection
              knownEvents={KNOWN_EVENT_TYPES as readonly string[]}
              state={state}
              onChange={onChange}
            />
            <SchedulesSection state={state} onChange={onChange} />
            <HeartbeatSection state={state} onChange={onChange} />
            <BudgetSection state={state} onChange={onChange} />
            <AdvancedSection state={state} onChange={onChange} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="lg:sticky lg:top-0">
              <ReadinessSection state={state} />
            </div>
            <RelationshipsSection agentId={agent.id} fromActorId={agent.actorId} />
            <ActivitySection agent={{ actorId: agent.actorId }} agentId={agent.id} />
          </div>
        </div>

        <SaveBar
          dirty={dirty}
          saving={saving}
          saved={saved}
          error={error}
          onSave={() => void save()}
        />
      </div>
    </div>
  );
}