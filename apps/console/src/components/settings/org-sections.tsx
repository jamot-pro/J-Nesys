"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Layers, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SectionHeading, Card } from "./section-primitives";
import { ChannelsSection } from "./channels-section";
import { ComposioConnectors } from "./composio-connectors";
import { WorkspacesSection } from "./workspaces-section";
import {
  CapabilitiesSection as CapabilitiesDataSection,
  KnowledgeSection as KnowledgeDataSection,
  OrgMemorySection as OrgMemoryDataSection,
  SharedSkillsSection as SharedSkillsDataSection,
} from "./org-data-sections";
import { useActiveOrg } from "./use-active-org";
import {
  getAgents,
  getOrganizations,
  listWorkspaces,
  updateWorkspace,
} from "@/lib/api-client";

function OrgStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <SectionHeading title={title} description={description} />
      <Card className="max-w-xl">
        <p className="text-sm text-muted-foreground">
          This section is a placeholder and will be fleshed out in a later phase.
        </p>
      </Card>
    </div>
  );
}

export function GeneralOrgSection() {
  return <WorkspacesSection />;
}

export { PeopleOrgSection } from "./people-org-section";
export { AppsOrgSection } from "./apps-org-section";

export function RolesOrgSection() {
  return <OrgStub title="Roles" description="Define roles and permissions." />;
}

export function OrganicChartSection() {
  return (
    <OrgStub
      title="OrganicChart"
      description="The living org chart of your organization."
    />
  );
}

export function OrgAgentsSection() {
  const { organizationId } = useActiveOrg();
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof getAgents>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAgents()
      .then((items) => {
        if (cancelled) return;
        setAgents(
          organizationId
            ? items.filter((agent) => agent.organizationIds.includes(organizationId))
            : [],
        );
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <div>
      <SectionHeading
        title="Agents"
        description="Shared organization agents. Open one to configure it."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No agents deployed to this organization yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        agent.availability === "available"
                          ? "bg-emerald-500"
                          : agent.availability === "busy"
                            ? "bg-amber-500"
                            : "bg-zinc-400",
                      )}
                    />
                    {agent.role ?? agent.id}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{agent.availability}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ChannelsOrgSection() {
  return <ChannelsSection />;
}

export function ConnectorsOrgSection() {
  return <ComposioConnectors mode="org" />;
}

export function SharedSkillsSection() {
  return <SharedSkillsDataSection />;
}
export function PoliciesSection() {
  return <OrgStub title="Policies" description="Policies that govern agent behavior." />;
}

export function TreasurySection() {
  return <OrgStub title="Treasury" description="Budgets and financial controls." />;
}

export function DreamSection() {
  return <OrgStub title="Dream" description="Long-term goals and vision." />;
}

export function OrgMemorySection() {
  return <OrgMemoryDataSection />;
}

export function CapabilitiesOrgSection() {
  return <CapabilitiesDataSection />;
}

export function KnowledgeOrgSection() {
  return <KnowledgeDataSection />;
}

export function AuditSection() {
  return <OrgStub title="Audit" description="Audit logs and compliance." />;
}

/** Workspace-level settings: rename the current workspace and edit its config.
 * Org admins can edit; members see a read-only view. */
export function WorkspaceSettingsSection() {
  const { space, isOrg, organizationId, isAdmin } = useActiveOrg();
  const workspaceId = space.workspaceId ?? null;

  const [orgId, setOrgId] = useState<string>("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [configText, setConfigText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOrg || !organizationId) return;
    let cancelled = false;
    void (async () => {
      try {
        setOrgId(organizationId);
        const orgs = await getOrganizations();
        const item = orgs.find((o) => o.organization.id === organizationId);
        const ws = item?.workspaces?.length
          ? item.workspaces
          : await listWorkspaces(organizationId);
        const current = ws.find((w) => w.id === workspaceId) ?? ws[0];
        if (!cancelled) {
          setWorkspaceName(current?.name ?? space.name);
          setConfigText(
            current?.config ? JSON.stringify(current.config, null, 2) : "{}",
          );
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load workspace settings.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOrg, organizationId, workspaceId, space.name]);

  if (!isOrg || !organizationId || !workspaceId) {
    return (
      <div>
        <SectionHeading
          title="Workspace"
          description="Per-workspace settings and configuration."
        />
        <Card className="max-w-xl">
          <div className="flex items-center gap-3">
            <Layers className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Open an organization workspace to manage its settings.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const save = async () => {
    if (!orgId || !workspaceId || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    let config: Record<string, unknown> | undefined;
    try {
      config = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      setError("Config must be valid JSON.");
      setSaving(false);
      return;
    }
    try {
      await updateWorkspace(orgId, workspaceId, {
        name: workspaceName.trim() || undefined,
        config,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save workspace settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Workspace"
        description="Each workspace is an isolated tenant with its own configuration and data."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Workspace name</label>
          <Input
            value={workspaceName}
            disabled={!isAdmin || loading}
            onChange={(e) => {
              setWorkspaceName(e.target.value);
              setSaved(false);
            }}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Configuration (JSON)</label>
          <textarea
            rows={8}
            value={configText}
            disabled={!isAdmin || loading}
            onChange={(e) => {
              setConfigText(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Workspace settings saved.</p> : null}

        <div className="flex justify-end">
          {isAdmin ? (
            <Button onClick={() => void save()} disabled={saving || loading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only admins can edit workspace settings.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

