import type {
  OrgEdgeRelation,
  OrgGraph,
  OrgNodeKind,
} from "@/lib/api-client";

export type {
  OrgEdge,
  OrgEdgeRelation,
  OrgGraph,
  OrgNode,
  OrgNodeKind as OrgKind,
} from "@/lib/api-client";

export const KIND_LABEL: Record<OrgNodeKind, string> = {
  dream: "Dream",
  team: "Team",
  human: "Human",
  agent: "Agent",
  responsibility: "Responsibility",
  tool: "Tool",
  heartbeat: "Heartbeat",
};

export const KIND_ACCENT: Record<OrgNodeKind, string> = {
  dream: "#8b5cf6",
  team: "#14b8a6",
  human: "#0ea5e9",
  agent: "#10b981",
  responsibility: "#f59e0b",
  tool: "#a1a1aa",
  heartbeat: "#f43f5e",
};

export const RELATION_LABEL: Record<OrgEdgeRelation, string> = {
  requires: "requires",
  owns: "owns",
  member_of: "member of",
  responsible_for: "responsible for",
  uses: "uses",
  has_access_to: "has access to",
  monitors: "monitors",
  invokes: "invokes",
  depends_on: "depends on",
};

export const RELATIONS: OrgEdgeRelation[] = [
  "requires",
  "owns",
  "member_of",
  "responsible_for",
  "uses",
  "has_access_to",
  "monitors",
  "invokes",
  "depends_on",
];

/**
 * Which relations are meaningful to draw FROM a given source node kind. Used by
 * the relation picker that opens when a user drags a new connection.
 */
export const ALLOWED_RELATIONS_FROM: Record<OrgNodeKind, OrgEdgeRelation[]> = {
  dream: ["requires", "owns", "depends_on"],
  team: ["owns", "requires", "uses", "depends_on"],
  human: ["responsible_for", "uses", "has_access_to", "member_of", "invokes", "owns"],
  agent: ["responsible_for", "uses", "has_access_to", "member_of", "invokes", "owns"],
  responsibility: ["requires", "depends_on", "uses"],
  tool: ["has_access_to", "invokes", "requires"],
  heartbeat: ["monitors", "invokes", "depends_on"],
};

export interface ChangeRequest {
  nodeId: string;
  nodeLabel: string;
  newParentId: string;
  newParentLabel: string;
}

/** Parent-forming relations used to derive a deterministic tree for layout. */
export const PARENT_RELATIONS: OrgEdgeRelation[] = [
  "member_of",
  "owns",
  "depends_on",
];

/** A small sample graph used when OrgChart renders without a live orgId. */
export const sampleGraph: OrgGraph = {
  nodes: [
    {
      id: "dream",
      organizationId: "sample",
      kind: "dream",
      name: "DREAM",
      refId: null,
      config: {
        objective: "€1M ARR AI consulting company",
        outcomes: ["Repeatable delivery", "Defensible moat"],
        kpis: [
          { name: "ARR", target: "€1M", unit: "EUR" },
          { name: "Net retention", target: ">110%", unit: "percent" },
        ],
      },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "team-core",
      organizationId: "sample",
      kind: "team",
      name: "Core Team",
      refId: null,
      config: { mission: "Deliver client outcomes end to end." },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "hum-owner",
      organizationId: "sample",
      kind: "human",
      name: "Andrea",
      refId: null,
      config: { title: "Founder & Owner" },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "ag-sales",
      organizationId: "sample",
      kind: "agent",
      name: "Sales Agent",
      refId: null,
      config: { autonomy: "approve" },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "resp-delivery",
      organizationId: "sample",
      kind: "responsibility",
      name: "Delivery",
      refId: null,
      config: {},
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "tool-crm",
      organizationId: "sample",
      kind: "tool",
      name: "CRM",
      refId: null,
      config: { provider: "mcp" },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "hb-pulse",
      organizationId: "sample",
      kind: "heartbeat",
      name: "Weekly pulse",
      refId: null,
      config: {
        schedule: "0 9 * * 1",
        monitors: ["pipeline", "NPS"],
        actions: ["escalate"],
        enabled: true,
      },
      position: { x: 0, y: 0 },
      createdAt: "",
      updatedAt: "",
    },
  ],
  edges: [
    {
      id: "e1",
      organizationId: "sample",
      fromNodeId: "team-core",
      toNodeId: "dream",
      relation: "member_of",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e2",
      organizationId: "sample",
      fromNodeId: "hum-owner",
      toNodeId: "team-core",
      relation: "member_of",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e3",
      organizationId: "sample",
      fromNodeId: "ag-sales",
      toNodeId: "team-core",
      relation: "member_of",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e4",
      organizationId: "sample",
      fromNodeId: "hum-owner",
      toNodeId: "resp-delivery",
      relation: "owns",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e5",
      organizationId: "sample",
      fromNodeId: "ag-sales",
      toNodeId: "tool-crm",
      relation: "uses",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "e6",
      organizationId: "sample",
      fromNodeId: "hb-pulse",
      toNodeId: "team-core",
      relation: "monitors",
      metadata: {},
      validFrom: "",
      validTo: null,
      createdAt: "",
      updatedAt: "",
    },
  ],
};