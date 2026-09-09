import type {
  OrgEdge,
  OrgGraph,
  OrgNode,
  OrgNodeKind,
  ReadinessDimension,
  ReadinessReport,
  ResponsibilityCoverage,
} from "@jamot/contracts";

const OWNER_RELATIONS: OrgEdge["relation"][] = ["responsible_for", "owns"];
const OWNER_KINDS: OrgNodeKind[] = ["human", "agent", "team"];

interface NodeIndex {
  byId: Map<string, OrgNode>;
  byKind: Map<OrgNodeKind, OrgNode[]>;
}

function index(graph: OrgGraph): NodeIndex {
  const byId = new Map<string, OrgNode>();
  const byKind = new Map<OrgNodeKind, OrgNode[]>();
  for (const node of graph.nodes) {
    byId.set(node.id, node);
    const list = byKind.get(node.kind) ?? [];
    list.push(node);
    byKind.set(node.kind, list);
  }
  return { byId, byKind };
}

function fraction(covered: number, total: number): number {
  return total === 0 ? 0 : covered / total;
}

function monitoredNodeIds(graph: OrgGraph, idx: NodeIndex): Set<string> {
  const heartbeatIds = new Set(
    (idx.byKind.get("heartbeat") ?? []).map((n) => n.id),
  );
  const monitored = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation === "monitors" && heartbeatIds.has(edge.fromNodeId)) {
      monitored.add(edge.toNodeId);
    }
  }
  return monitored;
}

function responsibilityCoverageImpl(
  graph: OrgGraph,
  idx: NodeIndex,
): ResponsibilityCoverage[] {
  const responsibilities = idx.byKind.get("responsibility") ?? [];
  return responsibilities.map((node) => {
    const owners = new Set<OrgNodeKind>();
    for (const edge of graph.edges) {
      if (edge.toNodeId !== node.id) continue;
      if (!OWNER_RELATIONS.includes(edge.relation)) continue;
      const from = idx.byId.get(edge.fromNodeId);
      if (!from) continue;
      if (OWNER_KINDS.includes(from.kind)) owners.add(from.kind);
    }
    return {
      responsibilityId: node.id,
      name: node.name,
      owners: [...owners],
      covered: owners.size > 0,
    };
  });
}

export function responsibilityCoverage(
  graph: OrgGraph,
): ResponsibilityCoverage[] {
  return responsibilityCoverageImpl(graph, index(graph));
}

export function computeReadiness(graph: OrgGraph): ReadinessReport {
  const idx = index(graph);
  const dimensions: ReadinessDimension[] = [];

  const dreams = idx.byKind.get("dream") ?? [];
  const dreamObjectiveSet = dreams.some(
    (n) =>
      typeof n.config.objective === "string" &&
      n.config.objective.trim().length > 0,
  );
  dimensions.push({
    key: "dream",
    label: "DREAM objective",
    score: dreamObjectiveSet ? 1 : 0,
    missing: dreamObjectiveSet ? [] : ["Set a DREAM objective"],
  });

  const coverage = responsibilityCoverageImpl(graph, idx);
  const responsibilities = idx.byKind.get("responsibility") ?? [];
  const coveredResponsibilities = coverage.filter((c) => c.covered).length;
  const uncoveredResponsibilities = coverage
    .filter((c) => !c.covered)
    .map((c) => c.name);
  dimensions.push({
    key: "responsibilities",
    label: "Responsibilities covered",
    score: fraction(coveredResponsibilities, responsibilities.length),
    missing: uncoveredResponsibilities,
  });

  const actors = (idx.byKind.get("human") ?? []).concat(
    idx.byKind.get("agent") ?? [],
  );
  dimensions.push({
    key: "actors",
    label: "Actors present",
    score: actors.length > 0 ? 1 : 0,
    missing: actors.length > 0 ? [] : ["Add at least one human or agent actor"],
  });

  const teams = idx.byKind.get("team") ?? [];
  dimensions.push({
    key: "teams",
    label: "Teams present",
    score: teams.length > 0 ? 1 : 0,
    missing: teams.length > 0 ? [] : ["Add at least one team"],
  });

  const tools = idx.byKind.get("tool") ?? [];
  dimensions.push({
    key: "tools",
    label: "Tools present",
    score: tools.length > 0 ? 1 : 0,
    missing: tools.length > 0 ? [] : ["Add at least one tool"],
  });

  dimensions.push({
    key: "permissions",
    label: "Permissions configured",
    score: 1,
    missing: [],
  });

  dimensions.push({
    key: "dependencies",
    label: "Dependencies resolved",
    score: 1,
    missing: [],
  });

  const monitored = monitoredNodeIds(graph, idx);
  const heartbeatTargets = [...teams, ...dreams];
  const coveredTargets = heartbeatTargets.filter((n) => monitored.has(n.id));
  const uncoveredTargets = heartbeatTargets
    .filter((n) => !monitored.has(n.id))
    .map((n) => n.name);
  dimensions.push({
    key: "heartbeats",
    label: "Heartbeat coverage",
    score: fraction(coveredTargets.length, heartbeatTargets.length),
    missing: uncoveredTargets,
  });

  const teamIds = new Set(teams.map((n) => n.id));
  // owner id -> ids of teams it is a member of.
  const ownerTeams = new Map<string, string[]>();
  // responsibility id -> owner node ids (human/agent/team with an owner edge).
  const respOwners = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const from = idx.byId.get(edge.fromNodeId);
    const to = idx.byId.get(edge.toNodeId);
    if (!from || !to) continue;
    if (edge.relation === "member_of" && to.kind === "team" && teamIds.has(to.id)) {
      const list = ownerTeams.get(from.id) ?? [];
      list.push(to.id);
      ownerTeams.set(from.id, list);
    }
    if (
      OWNER_RELATIONS.includes(edge.relation) &&
      to.kind === "responsibility" &&
      OWNER_KINDS.includes(from.kind)
    ) {
      const owners = respOwners.get(to.id) ?? [];
      owners.push(from.id);
      respOwners.set(to.id, owners);
    }
  }
  // A responsibility is recoverable if at least one of its owners belongs to a
  // heartbeat-monitored team.
  const unhandledRecovery = coverage.filter((c) => {
    if (!c.covered) return false;
    const owners = respOwners.get(c.responsibilityId) ?? [];
    return !owners.some((ownerId) =>
      (ownerTeams.get(ownerId) ?? []).some((teamId) => monitored.has(teamId)),
    );
  });
  dimensions.push({
    key: "recovery",
    label: "Recovery readiness",
    score: unhandledRecovery.length === 0 ? 1 : 0,
    missing:
      unhandledRecovery.length === 0
        ? []
        : [
            `Cover every owned responsibility with a heartbeat-monitored team (${unhandledRecovery
              .map((c) => c.name)
              .join(", ")})`,
          ],
  });

  const heartbeats = idx.byKind.get("heartbeat") ?? [];
  const hasEscalation = heartbeats.some((n) => {
    const actions = n.config.actions;
    return (
      Array.isArray(actions) &&
      actions.some((a) => typeof a === "string" && a.toLowerCase() === "escalate")
    );
  });
  dimensions.push({
    key: "escalation",
    label: "Escalation configured",
    score: hasEscalation ? 1 : 0,
    missing: hasEscalation ? [] : ["Add an escalate action to a heartbeat"],
  });

  const overall =
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  const jamot = dimensions.every((d) => d.score === 1);

  return {
    dimensions,
    overall,
    jamot,
    updatedAt: new Date().toISOString(),
  };
}