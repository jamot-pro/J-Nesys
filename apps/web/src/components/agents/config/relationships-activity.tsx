"use client";

import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Network, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfigSection } from "./config-section";
import { RELATIONSHIP_KINDS } from "./agent-config-types";
import {
  addAgentRelationship,
  getAgentActivity,
  listAgentRelationships,
  listActors,
  removeAgentRelationship,
  type ApiActor,
  type ApiAgentRelationship,
  type ApiEvent,
} from "@/lib/api-client";

export function RelationshipsSection({
  agentId,
  fromActorId,
}: {
  agentId: string;
  fromActorId: string;
}) {
  const [relationships, setRelationships] = useState<ApiAgentRelationship[]>([]);
  const [actors, setActors] = useState<ApiActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toActorId, setToActorId] = useState("");
  const [kind, setKind] = useState<(typeof RELATIONSHIP_KINDS)[number]>("reports_to");

  const reload = async () => {
    try {
      const [items, allActors] = await Promise.all([
        listAgentRelationships(agentId),
        listActors(),
      ]);
      setRelationships(items);
      setActors(allActors);
    } catch {
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAgentRelationships(agentId), listActors()])
      .then(([items, allActors]) => {
        if (cancelled) return;
        setRelationships(items);
        setActors(allActors);
      })
      .catch(() => {
        if (!cancelled) setRelationships([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const add = async () => {
    if (!toActorId) return;
    setError(null);
    try {
      await addAgentRelationship({
        agentId,
        fromActorId,
        toActorId,
        kind,
      });
      setToActorId("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add relationship.");
    }
  };

  const remove = async (relationshipId: string) => {
    await removeAgentRelationship(agentId, relationshipId);
    await reload();
  };

  return (
    <ConfigSection
      title="Relationships"
      description="How this agent relates to other actors (people and agents)."
      icon={<Network className="size-4" />}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading relationships…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {relationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No relationships yet. Add one to define who this agent reports to,
              collaborates with, or supports.
            </p>
          ) : (
            relationships.map((relationship) => {
              const other =
                relationship.toActorId === fromActorId
                  ? relationship.from
                  : relationship.to;
              return (
                <div
                  key={relationship.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {relationship.kind}
                    </Badge>
                    <span className="truncate text-sm">
                      {other?.displayName ?? "Unknown actor"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(relationship.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remove relationship"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm font-medium">Add a relationship</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={toActorId}
                onChange={(event) => setToActorId(event.target.value)}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select an actor…</option>
                {actors
                  .filter((actor) => actor.type === "human")
                  .map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.displayName} (human)
                    </option>
                  ))}
                {actors
                  .filter((actor) => actor.type === "agent")
                  .map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.displayName} (agent)
                    </option>
                  ))}
              </select>
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as (typeof RELATIONSHIP_KINDS)[number])
                }
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {RELATIONSHIP_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
            <button
              type="button"
              disabled={!toActorId}
              onClick={() => void add()}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-4" />
              Add
            </button>
          </div>
        </div>
      )}
    </ConfigSection>
  );
}

export function ActivitySection({
  agent,
  agentId,
}: {
  agent: { actorId: string };
  agentId: string;
}) {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAgentActivity(agentId)
      .then((items) => {
        if (!cancelled) setEvents(items);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, agent.actorId]);

  return (
    <ConfigSection
      title="Activity"
      description="Recent events involving this agent."
      icon={<ActivityIcon className="size-4" />}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="font-mono text-xs">{event.type}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ConfigSection>
  );
}