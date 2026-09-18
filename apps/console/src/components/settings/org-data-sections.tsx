"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addKnowledgeEdge,
  addKnowledgeEntity,
  createCapability,
  createSkill,
  forgetMemory,
  listCapabilities,
  listConnectors,
  listKnowledgeEdges,
  listKnowledgeEntities,
  listMemory,
  listSkills,
  storeMemory,
} from "@/lib/api-client";
import { Card, Field, SectionHeading, TextInput } from "./section-primitives";
import { useActiveOrg } from "./use-active-org";

function noteOf(content: Record<string, unknown>): string {
  return typeof content.note === "string" ? content.note : JSON.stringify(content);
}

/* ------------------------------ Shared Skills ------------------------------ */

export function SharedSkillsSection() {
  const { organizationId, isOrg } = useActiveOrg();
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof listSkills>>>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSkills(organizationId ?? undefined)
      .then((items) => {
        if (!cancelled) setSkills(items);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const skill = await createSkill({
        name,
        ownerOrganizationId: organizationId,
        status: "draft",
      });
      setSkills((prev) => [...prev, skill]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create skill.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOrg) {
    return <OrgOnlyCard title="Shared Skills" description="Open an organization space to manage its skills." />;
  }

  return (
    <div>
      <SectionHeading
        title="Shared Skills"
        description="Skills shared across teams in this organization."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill.id}>
                <Badge variant="secondary">{skill.name}</Badge>
              </li>
            ))}
            {skills.length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">No skills yet.</li>
            ) : null}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <TextInput
            placeholder="New skill…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <Button size="sm" disabled={!draft.trim() || busy} onClick={() => void add()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}

/* ------------------------------ Org Memory ------------------------------ */

export function OrgMemorySection() {
  const { organizationId, isOrg } = useActiveOrg();
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof listMemory>>>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    listMemory("organization", organizationId)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const add = async () => {
    const text = draft.trim();
    if (!text || !organizationId) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await storeMemory({
        scope: "organization",
        ownerId: organizationId,
        content: { note: text },
      });
      setEntries((prev) => [...prev, entry]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save memory.");
    } finally {
      setBusy(false);
    }
  };

  const forget = async (id: string) => {
    await forgetMemory(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  if (!isOrg) {
    return <OrgOnlyCard title="Memory" description="Open an organization space to see shared memory." />;
  }

  return (
    <div>
      <SectionHeading
        title="Memory"
        description="Shared organizational memory."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No memories yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{noteOf(entry.content)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label="Forget"
                  onClick={() => void forget(entry.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <TextInput
            placeholder="e.g. Q3 supplier list confirmed"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <Button size="sm" disabled={!draft.trim() || busy} onClick={() => void add()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}

/* ------------------------------ Capabilities ------------------------------ */

export function CapabilitiesSection() {
  const { space, isOrg } = useActiveOrg();
  const spaceId = space.spaceId ?? null;
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof listCapabilities>>>([]);
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof listSkills>>>([]);
  const [connectors, setConnectors] = useState<Awaited<ReturnType<typeof listConnectors>>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [skillId, setSkillId] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCapabilities(spaceId ?? undefined),
      listSkills(),
      listConnectors(),
    ])
      .then(([capabilities, skills, connectors]) => {
        if (cancelled) return;
        setCapabilities(capabilities);
        setSkills(skills);
        setConnectors(connectors);
      })
      .catch(() => {
        if (!cancelled) setCapabilities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const save = async () => {
    if (!name.trim() || !skillId || !connectorId || !spaceId) return;
    setBusy(true);
    setError(null);
    try {
      const capability = await createCapability({
        name: name.trim(),
        skillId,
        connectorId,
        spaceId,
      });
      setCapabilities((prev) => [...prev, capability]);
      setAdding(false);
      setName("");
      setSkillId("");
      setConnectorId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create capability.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOrg) {
    return <OrgOnlyCard title="Capabilities" description="Open an organization space to define capabilities." />;
  }

  return (
    <div>
      <SectionHeading
        title="Capabilities"
        description="Actionable operations derived from a skill + connector."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : capabilities.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No capabilities yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {capabilities.map((capability) => (
              <li
                key={capability.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{capability.name}</span>
                <span className="text-xs text-muted-foreground">
                  {capability.skillId.slice(0, 8)} · {capability.connectorId.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {adding ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3">
            <Field label="Name">
              <TextInput
                placeholder="e.g. customer.whatsapp.reply"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Skill">
              <select
                value={skillId}
                onChange={(event) => setSkillId(event.target.value)}
                className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm"
              >
                <option value="">Select…</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Connector">
              <select
                value={connectorId}
                onChange={(event) => setConnectorId(event.target.value)}
                className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm"
              >
                <option value="">Select…</option>
                {connectors.map((connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.provider}
                  </option>
                ))}
              </select>
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!name.trim() || !skillId || !connectorId || busy}
                onClick={() => void save()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              New capability
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Knowledge ------------------------------ */

export function KnowledgeSection() {
  const [entities, setEntities] = useState<Awaited<ReturnType<typeof listKnowledgeEntities>>>([]);
  const [edges, setEdges] = useState<Awaited<ReturnType<typeof listKnowledgeEdges>>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("person");
  const [name, setName] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [relation, setRelation] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listKnowledgeEntities()
      .then((items) => {
        if (!cancelled) setEntities(items);
      })
      .catch(() => {
        if (!cancelled) setEntities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEntityId) return;
    let cancelled = false;
    listKnowledgeEdges(selectedEntityId)
      .then((items) => {
        if (!cancelled) setEdges(items);
      })
      .catch(() => {
        if (!cancelled) setEdges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEntityId]);

  const addEntity = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const entity = await addKnowledgeEntity({ type, name: trimmed });
      setEntities((prev) => [...prev, entity]);
      setName("");
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add entity.");
    } finally {
      setBusy(false);
    }
  };

  const addEdge = async () => {
    if (!selectedEntityId || !relation.trim() || !targetId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const edge = await addKnowledgeEdge({
        sourceId: selectedEntityId,
        targetId: targetId.trim(),
        relation: relation.trim(),
      });
      setEdges((prev) => [...prev, edge]);
      setRelation("");
      setTargetId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add relation.");
    } finally {
      setBusy(false);
    }
  };

  const entityName = (id: string): string =>
    entities.find((entity) => entity.id === id)?.name ?? id.slice(0, 8);

  return (
    <div>
      <SectionHeading
        title="Knowledge"
        description="The shared knowledge graph of entities and relations."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : entities.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No entities yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {entities.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntityId(entity.id);
                    setEdges([]);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                    selectedEntityId === entity.id && "bg-muted/70",
                  )}
                >
                  <span className="font-medium">{entity.name}</span>
                  <Badge variant="secondary">{entity.type}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedEntityId ? (
          <div className="mt-4 rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">
              Relations from {entityName(selectedEntityId)}
            </p>
            {edges.length === 0 ? (
              <p className="mb-2 text-xs text-muted-foreground">No relations yet.</p>
            ) : (
              <ul className="mb-2 flex flex-col gap-1">
                {edges.map((edge) => (
                  <li key={edge.id} className="text-sm">
                    <span className="text-muted-foreground">
                      {edge.relation} → {entityName(edge.targetId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <TextInput
                placeholder="relation, e.g. reports_to"
                value={relation}
                onChange={(event) => setRelation(event.target.value)}
              />
              <TextInput
                placeholder="target entity id"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              />
              <Button size="sm" disabled={!relation.trim() || !targetId.trim() || busy} onClick={() => void addEdge()}>
                Add
              </Button>
            </div>
          </div>
        ) : null}

        {adding ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3">
            <Field label="Type">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm"
              >
                {["person", "organization", "agent", "product", "project", "note"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <TextInput
                placeholder="Entity name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!name.trim() || busy} onClick={() => void addEntity()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Add entity
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add entity
            </Button>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}

function OrgOnlyCard({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <SectionHeading title={title} />
      <Card className="max-w-xl">
        <p className="text-sm text-muted-foreground">{description}</p>
      </Card>
    </div>
  );
}
