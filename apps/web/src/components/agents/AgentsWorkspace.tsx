"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Plus } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { DirectoryToolbar } from "@/components/directory/DirectoryToolbar";
import { useDirectorySearch } from "@/components/directory/use-directory-search";
import type { DirectoryMatch } from "@/components/directory/search";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { getAgents } from "@/lib/api-client";
import { agentToAgentProfile } from "@/lib/live-directory";
import { AgentConfigurator } from "./config/agent-configurator";
import { CreateAgentWizard } from "./CreateAgentWizard";
import { AgentsTable } from "./AgentsTable";
import type { AgentProfile as Agent } from "./agents-data";

export function AgentsWorkspace() {
  const { space } = useAppShell();
  const orgId = space.kind === "organization" ? space.organizationId : undefined;
  return (
    <AgentsDirectory
      key={space.id}
      orgId={orgId}
      isOrganization={space.kind === "organization"}
    />
  );
}

function AgentsDirectory({
  orgId,
  isOrganization,
}: {
  orgId: string | undefined;
  isOrganization: boolean;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAgents()
      .then((items) => {
        if (cancelled) return;
        const visible = orgId
          ? items.filter((agent) => agent.organizationIds.includes(orgId))
          : items;
        setAgents(visible.map(agentToAgentProfile));
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
  }, [orgId, reloadKey]);

  const reloadAgents = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const search = useDirectorySearch({ kind: "agents", people: [], agents });

  const byId = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  const matches = useMemo(() => {
    const map: Record<string, DirectoryMatch> = {};
    for (const match of search.results) map[match.id] = match;
    return map;
  }, [search.results]);

  const visible = useMemo(() => {
    const trimmed = search.query.trim();
    if (!trimmed) return agents;
    const ranked: Agent[] = [];
    for (const match of search.results) {
      const agent = byId.get(match.id);
      if (agent) ranked.push(agent);
    }
    return ranked;
  }, [search.query, search.results, byId, agents]);

  const showSearchResult = search.query.trim() !== "" && search.hasSearched;

  const openAgent = (id: string) => setSelectedId(id);

  const handleCreated = (id: string) => {
    setCreating(false);
    setSelectedId(id);
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {selectedId ? (
        <AgentConfigurator
          key={selectedId}
          agentId={selectedId}
          onBack={() => {
            setSelectedId(null);
            reloadAgents();
          }}
          onDeleted={() => {
            setSelectedId(null);
            reloadAgents();
          }}
        />
      ) : (
        <>
          <DirectoryToolbar
            placeholder="Search agents… try “reconciliation”, “quiet hours”, “telegram”"
            query={search.query}
            loading={search.searching}
            onQueryChange={search.updateQuery}
            onSubmit={search.submit}
            onClear={search.clear}
            actionLabel="Add an agent"
            actionIcon={<Plus className="size-3.5" />}
            onAction={() => setCreating(true)}
          />

          <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {showSearchResult && search.searching ? (
              <div className="shrink-0 border-b border-border px-4 py-2 text-sm text-muted-foreground">
                Asking Main Manager to interpret the matches…
              </div>
            ) : null}

            {search.interpretation && showSearchResult ? (
              <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-sm">
                {search.interpretation}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Loader2}
                  title="Loading agents…"
                  description="Fetching agents for this space."
                />
              </div>
            ) : showSearchResult && visible.length === 0 ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Bot}
                  title="No agents match your search"
                  description={`“${search.query}” didn’t match any agent in this directory.`}
                />
              </div>
            ) : !showSearchResult && agents.length === 0 ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Bot}
                  title="No agents here yet"
                  description={
                    isOrganization
                      ? "No agents are deployed to this organization yet."
                      : "This is your personal space. Switch to an organization to see its agents."
                  }
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1">
                <AgentsTable
                  agents={visible}
                  matches={matches}
                  showMatch={showSearchResult}
                  onOpen={openAgent}
                />
              </div>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {creating ? (
          <>
            <motion.div
              className="absolute inset-0 z-20 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreating(false)}
            />
            <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-4">
              <motion.div
                className="my-auto w-full max-w-lg"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "tween", duration: 0.15 }}
              >
                <CreateAgentWizard
                  onCreated={handleCreated}
                  onDone={() => setCreating(false)}
                />
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}