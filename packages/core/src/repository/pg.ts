import { randomUUID } from "node:crypto";
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { MergeCandidateStatus } from "@jamot/contracts";
import type {
  Actor,
  Agent,
  BuyerAgreement,
  Capability,
  Catalog,
  CatalogOffer,
  Connector,
  Event,
  Identity,
  LeadList,
  LeadListMember,
  MergeCandidate,
  OrgEdge,
  OrgNode,
  Organization,
  OutreachCampaign,
  OutreachList,
  OutreachSend,
  OutreachStep,
  PaymentIntent,
  PaymentRecord,
  Person,
  Policy,
  Product,
  PurchaseOrder,
  Quote,
  QuoteRequest,
  Relationship,
  Role,
  Skill,
  Space,
  Supplier,
  Task,
  TaskAttachment,
  TaskList,
  Workspace,
} from "@jamot/contracts";
import type { Id } from "@jamot/contracts";
import type { Db } from "../db.js";
import {
  actors,
  agents,
  buyerAgreements,
  capabilities,
  catalogs,
  catalogOffers,
  composioOauthStates,
  connectors,
  events,
  identities,
  modelProviders,
  organizations,
  personMergeCandidates,
  providerModels,
  workspaces,
  outreachCampaigns,
  outreachLists,
  outreachSends,
  outreachSteps,
  paymentIntents,
  paymentRecords,
  people,
  policies,
  productBase,
  purchaseOrders,
  quotes,
  quoteRequests,
  relationships,
  roles,
  secrets,
  skills,
  spaceSettings,
  spaces,
  suppliers,
  taskAttachments,
  taskLists,
  tasks,
  leadLists,
  leadListMembers,
  orgEdges,
  orgNodes,
} from "../schema/index.js";
import type {
  JamotRepository,
  NewBuyerAgreement,
  NewActor,
  NewAgent,
  NewCapability,
  NewCatalog,
  NewCatalogOffer,
  NewConnector,
  NewIdentity,
  NewLeadList,
  NewLeadListMember,
  NewLeadPerson,
  NewMergeCandidate,
  NewOrganization,
  NewOutreachCampaign,
  NewOutreachList,
  NewOutreachSend,
  NewOutreachStep,
  NewPaymentIntent,
  NewPaymentRecord,
  NewPerson,
  NewPolicy,
  NewProduct,
  NewPurchaseOrder,
  NewQuote,
  NewQuoteRequest,
  NewRole,
  NewSkill,
  NewSpace,
  NewSupplier,
  NewTask,
  NewTaskAttachment,
  NewTaskList,
  ComposioOAuthStateRecord,
  SecretRecord,
  ChannelAccountRecord,
  PeopleFilter,
  ModelProviderRecord,
  NewModelProvider,
  ProviderModelRecord,
} from "./repository.js";

type ActorRow = typeof actors.$inferSelect;
type AgentRow = typeof agents.$inferSelect;
type SpaceRow = typeof spaces.$inferSelect;
type OrganizationRow = typeof organizations.$inferSelect;
type WorkspaceRow = typeof workspaces.$inferSelect;
type RoleRow = typeof roles.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type TaskListRow = typeof taskLists.$inferSelect;
type TaskAttachmentRow = typeof taskAttachments.$inferSelect;
type SkillRow = typeof skills.$inferSelect;
type ConnectorRow = typeof connectors.$inferSelect;
type CapabilityRow = typeof capabilities.$inferSelect;
type PolicyRow = typeof policies.$inferSelect;
type SecretRow = typeof secrets.$inferSelect;
type ComposioOAuthStateRow = typeof composioOauthStates.$inferSelect;
type LeadListRow = typeof leadLists.$inferSelect;
type LeadListMemberRow = typeof leadListMembers.$inferSelect;
type OutreachListRow = typeof outreachLists.$inferSelect;
type OutreachCampaignRow = typeof outreachCampaigns.$inferSelect;
type OutreachStepRow = typeof outreachSteps.$inferSelect;
type OutreachSendRow = typeof outreachSends.$inferSelect;
type OrgNodeRow = typeof orgNodes.$inferSelect;
type OrgEdgeRow = typeof orgEdges.$inferSelect;

function toOrgNode(row: OrgNodeRow): OrgNode {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    organizationId: row.organizationId as Id,
    kind: row.kind,
    name: row.name,
    refId: (row.refId as Id | null) ?? null,
    config: (row.config ?? {}) as Record<string, unknown>,
    position: { x: row.positionX, y: row.positionY },
  };
}

function toOrgEdge(row: OrgEdgeRow): OrgEdge {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    organizationId: row.organizationId as Id,
    fromNodeId: row.fromNodeId as Id,
    toNodeId: row.toNodeId as Id,
    relation: row.relation,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo ? row.validTo.toISOString() : null,
  };
}

// The org graph is queried with raw SQL (Drizzle schema is schema-only), so the
// snake_case columns are aliased back to the camelCase row shape the mappers
// read. `created_at`/`updated_at` are formatted as ISO-8601 strings to match the
// schema's { mode: "string" } timestamps (and Zod's z.string().datetime());
// `valid_from`/`valid_to` stay timestamps so `toOrgEdge` can call `.toISOString()`.
const ORG_NODE_SELECT = `
  id,
  organization_id AS "organizationId",
  space_id AS "spaceId",
  kind,
  name,
  ref_id AS "refId",
  config,
  position_x AS "positionX",
  position_y AS "positionY",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
`;
const ORG_EDGE_SELECT = `
  id,
  organization_id AS "organizationId",
  space_id AS "spaceId",
  from_node_id AS "fromNodeId",
  to_node_id AS "toNodeId",
  relation,
  metadata,
  valid_from AS "validFrom",
  valid_to AS "validTo",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
`;

function toActor(row: ActorRow): Actor {
  return {
    id: row.id as Id,
    type: row.type,
    source: row.source,
    displayName: row.displayName,
    status: row.status,
    externalIdentities: row.externalIdentities,
    personalSpaceId: (row.personalSpaceId as Id | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPerson(row: typeof people.$inferSelect): Person {
  return {
    id: row.id as Id,
    actorId: row.actorId as Id,
    email: row.email,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    phone: row.phone ?? null,
    avatarUrl: row.avatarUrl ?? null,
    avatarSource: row.avatarSource ?? null,
    consent: row.consent ?? null,
    lastInteractionAt: row.lastInteractionAt ?? null,
    profile: row.profile,
    membershipSpaceIds: row.membershipSpaceIds as Id[],
    reputation: row.reputation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type IdentityRow = typeof identities.$inferSelect;

function toIdentity(row: IdentityRow): Identity {
  return {
    id: row.id as Id,
    actorId: row.actorId as Id,
    personId: (row.personId as Id | null) ?? null,
    provider: row.provider,
    value: row.value,
    verified: row.verified,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type ModelProviderRow = typeof modelProviders.$inferSelect;

function toModelProviderRecord(row: ModelProviderRow): ModelProviderRecord {
  return {
    id: row.id,
    ownerActorId: row.ownerActorId ?? null,
    ownerOrganizationId: row.ownerOrganizationId ?? null,
    name: row.name,
    baseUrl: row.baseUrl,
    credentialRef: row.credentialRef,
    status: (row.status as ModelProviderRecord["status"]) ?? "unknown",
    lastTestedAt: row.lastTestedAt ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type ProviderModelRow = typeof providerModels.$inferSelect;

function toProviderModelRecord(row: ProviderModelRow): ProviderModelRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    discovered: row.discovered,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type MergeCandidateRow = typeof personMergeCandidates.$inferSelect;

function toMergeCandidate(row: MergeCandidateRow): MergeCandidate {
  return {
    id: row.id as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    personAId: row.personAId as Id,
    personBId: row.personBId as Id,
    reason: row.reason,
    detail: row.detail,
    status: MergeCandidateStatus.parse(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    actorId: row.actorId as Id,
    ownerId: row.ownerId as Id,
    organizationIds: row.organizationIds as Id[],
    role: row.role,
    purpose: row.purpose,
    description: row.description,
    harness: row.harness,
    skillIds: row.skillIds as Id[],
    capabilityIds: row.capabilityIds as Id[],
    connectorIds: row.connectorIds as Id[],
    permissions: row.permissions as Id[],
    autonomy: row.autonomy,
    budget: row.budget === null ? null : Number(row.budget),
    heartbeat: {
      enabled: row.heartbeat?.enabled ?? false,
      cron: row.heartbeat?.cron ?? null,
      quietHours: row.heartbeat?.quietHours ?? null,
      check: row.heartbeat?.check ?? [],
      onAction: row.heartbeat?.onAction ?? "ask",
    },
    memoryScopes: row.memoryScopes,
    subscribedEvents: row.subscribedEvents,
    schedules: row.schedules,
    actionPermissions: row.actionPermissions,
    availability: row.availability,
    systemPrompt: row.systemPrompt,
    model: row.model ?? null,
    performance: row.performance,
  };
}

type RelationshipRow = typeof relationships.$inferSelect;
type EventRow = typeof events.$inferSelect;

function toRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fromActorId: row.fromActorId as Id,
    toActorId: row.toActorId as Id,
    kind: row.kind as Relationship["kind"],
  };
}

function toEvent(row: EventRow): Event {
  return {
    id: row.id as Id,
    type: row.type,
    spaceId: (row.spaceId as Id | null) ?? null,
    actorId: (row.actorId as Id | null) ?? null,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
    occurredAt: row.occurredAt,
    delivered: row.delivered,
  };
}

function toSpace(row: SpaceRow): Space {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    kind: row.kind,
    ownerActorId: row.ownerActorId as Id,
    name: row.name,
  };
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: row.spaceId as Id,
    slug: row.slug,
    logoUrl: row.logoUrl,
    dream: row.dream,
    blueprint: row.blueprint,
    enabledAppIds: row.enabledAppIds,
    treasuryId: (row.treasuryId as Id | null) ?? null,
    reputation: row.reputation,
  };
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    organizationId: row.organizationId as Id,
    spaceId: row.spaceId as Id,
    name: row.name,
    config: row.config,
  };
}

function toRole(row: RoleRow): Role {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    actorId: row.actorId as Id,
    spaceId: row.spaceId as Id,
    kind: row.kind,
    title: row.title,
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: row.spaceId as Id,
    projectId: (row.projectId as Id | null) ?? null,
    listId: (row.listId as Id | null) ?? null,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeActorIds: row.assigneeActorIds as Id[],
    targetType: row.targetType,
    requiredCapabilityIds: row.requiredCapabilityIds as Id[],
    outcome: row.outcome,
    dueDate: row.dueDate,
    position: row.position,
  };
}

function toTaskList(row: TaskListRow): TaskList {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: row.spaceId as Id,
    name: row.name,
    position: row.position,
  };
}

function toTaskAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    taskId: row.taskId as Id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    data: row.data,
  };
}

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ownerActorId: (row.ownerActorId as Id | null) ?? null,
    ownerOrganizationId: (row.ownerOrganizationId as Id | null) ?? null,
    name: row.name,
    description: row.description,
    body: row.body ?? "",
    version: row.version,
    inputs: row.inputs,
    outputs: row.outputs,
    prerequisites: row.prerequisites as Id[],
    allowedCapabilityIds: row.allowedCapabilityIds as Id[],
    evaluationCriteria: row.evaluationCriteria,
    provenance: row.provenance,
    status: row.status,
  };
}

function toConnector(row: ConnectorRow): Connector {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    provider: row.provider,
    type: row.type,
    ownerActorId: (row.ownerActorId as Id | null) ?? null,
    ownerOrganizationId: (row.ownerOrganizationId as Id | null) ?? null,
    sharing: (row.sharing as Connector["sharing"]) ?? "user",
    capabilities: row.capabilities,
    credentialRef: row.credentialRef,
    scopes: row.scopes,
    configuration: row.configuration,
    status: row.status,
  };
}

function toCapability(row: CapabilityRow): Capability {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    name: row.name,
    skillId: row.skillId as Id,
    connectorId: row.connectorId as Id,
    policyIds: row.policyIds as Id[],
    context: row.context,
    spaceId: row.spaceId as Id,
  };
}

function toPolicy(row: PolicyRow): Policy {
  return {
    id: row.id as Id,
    spaceId: row.spaceId as Id,
    name: row.name,
    capability: row.capability,
    resource: row.resource,
    minRole: row.minRole,
    riskThreshold: Number(row.riskThreshold),
    decision: row.decision,
  };
}

function toSecret(row: SecretRow): SecretRecord {
  return {
    ref: row.ref,
    scope: row.scope,
    ownerActorId: (row.ownerActorId as Id | null) ?? null,
    ownerOrganizationId: (row.ownerOrganizationId as Id | null) ?? null,
    ciphertext: row.ciphertext,
  };
}

function toComposioOAuthState(row: ComposioOAuthStateRow): ComposioOAuthStateRecord {
  return {
    state: row.state,
    actorId: row.actorId as Id,
    organizationId: (row.organizationId as Id | null) ?? null,
    sharing: (row.sharing as Connector["sharing"]) ?? "user",
    toolkit: row.toolkit,
    composioUserId: row.composioUserId,
    apiKeyScope: row.apiKeyScope,
    redirectUri: row.redirectUri,
    consumed: row.consumed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
  };
}

function toSupplier(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    actorId: row.actorId as Id,
    organizationId: (row.organizationId as Id | null) ?? null,
    onboardingStatus: row.onboardingStatus as Supplier["onboardingStatus"],
    defaultCurrency: row.defaultCurrency,
    terms: row.terms,
    reputation: row.reputation,
  };
}

function toProduct(row: typeof productBase.$inferSelect): Product {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: (row.spaceId as Id | null) ?? null,
    gtin: row.gtin,
    sku: row.sku,
    manufacturerId: row.manufacturerId,
    name: row.name,
    description: row.description,
    dimensions: row.dimensions,
    packaging: row.packaging,
    unitOfMeasure: row.unitOfMeasure,
    taxCategory: row.taxCategory,
    compliance: row.compliance,
    lifecycle: row.lifecycle as Product["lifecycle"],
  };
}

function toCatalog(row: typeof catalogs.$inferSelect): Catalog {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ownerOrganizationId: row.ownerOrganizationId as Id,
    name: row.name,
    version: row.version,
    visibility: row.visibility as Catalog["visibility"],
    source: row.source as Catalog["source"],
    sourceOfTruth: row.sourceOfTruth as Catalog["sourceOfTruth"],
    syncRef: row.syncRef,
    lastSyncAt: row.lastSyncAt,
    status: row.status as Catalog["status"],
  };
}

function toCatalogOffer(row: typeof catalogOffers.$inferSelect): CatalogOffer {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    catalogId: row.catalogId as Id,
    productId: row.productId as Id,
    sellerOrganizationId: row.sellerOrganizationId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    orderableUnit: row.orderableUnit,
    priceQuantity: row.priceQuantity,
    priceTiers: row.priceTiers as CatalogOffer["priceTiers"],
    minQty: row.minQty,
    maxQty: row.maxQty,
    orderIncrement: row.orderIncrement,
    availability: row.availability,
    leadTime: row.leadTime,
    validityFrom: row.validityFrom,
    validityTo: row.validityTo,
    taxIncluded: row.taxIncluded,
    status: row.status as CatalogOffer["status"],
  };
}

function toBuyerAgreement(row: typeof buyerAgreements.$inferSelect): BuyerAgreement {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    catalogOfferId: row.catalogOfferId as Id,
    buyerOrganizationId: row.buyerOrganizationId as Id,
    priceTiers: row.priceTiers as BuyerAgreement["priceTiers"],
    validityFrom: row.validityFrom,
    validityTo: row.validityTo,
  };
}

function toQuoteRequest(row: typeof quoteRequests.$inferSelect): QuoteRequest {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    buyerOrganizationId: row.buyerOrganizationId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    title: row.title,
    description: row.description,
    items: row.items as QuoteRequest["items"],
    status: row.status as QuoteRequest["status"],
    responseDeadline: row.responseDeadline,
    metadata: row.metadata,
  };
}

function toQuote(row: typeof quotes.$inferSelect): Quote {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    quoteRequestId: row.quoteRequestId as Id,
    sellerOrganizationId: row.sellerOrganizationId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    items: row.items as Quote["items"],
    total: Number(row.total),
    currency: row.currency,
    terms: row.terms,
    status: row.status as Quote["status"],
    transcript: row.transcript ?? [],
    validUntil: row.validUntil,
  };
}

function toPurchaseOrder(row: typeof purchaseOrders.$inferSelect): PurchaseOrder {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    quoteId: row.quoteId as Id,
    buyerOrganizationId: row.buyerOrganizationId as Id,
    sellerOrganizationId: row.sellerOrganizationId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    items: row.items as PurchaseOrder["items"],
    total: Number(row.total),
    currency: row.currency,
    status: row.status as PurchaseOrder["status"],
    approvedByActorId: (row.approvedByActorId as Id | null) ?? null,
    paymentIntentId: (row.paymentIntentId as Id | null) ?? null,
  };
}

function toPaymentIntent(row: typeof paymentIntents.$inferSelect): PaymentIntent {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    purchaseOrderId: row.purchaseOrderId as Id,
    buyerOrganizationId: row.buyerOrganizationId as Id,
    sellerOrganizationId: row.sellerOrganizationId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    currency: row.currency,
    estimatedAmount: Number(row.estimatedAmount),
    status: row.status as PaymentIntent["status"],
    provider: row.provider as PaymentIntent["provider"],
    requiresApproval: row.requiresApproval,
    approvedByActorId: (row.approvedByActorId as Id | null) ?? null,
    providerReference: row.providerReference,
    metadata: row.metadata,
  };
}

function toPaymentRecord(row: typeof paymentRecords.$inferSelect): PaymentRecord {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paymentIntentId: row.paymentIntentId as Id,
    spaceId: (row.spaceId as Id | null) ?? null,
    paidAmount: Number(row.paidAmount),
    currency: row.currency,
    providerReference: row.providerReference,
    settledAt: row.settledAt,
  };
}

function toLeadList(row: LeadListRow): LeadList {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    organizationId: (row.organizationId as Id | null) ?? null,
    spaceId: row.spaceId as Id,
    createdBy: (row.createdBy as Id | null) ?? null,
    name: row.name,
    description: row.description,
    persona: row.persona,
    area: (row.area as LeadList["area"]) ?? null,
    providerId: row.providerId,
    providerConfig: row.providerConfig,
    status: row.status as LeadList["status"],
    error: row.error,
    leadCount: row.leadCount,
    lastRunAt: row.lastRunAt,
  };
}

function toLeadListMember(row: LeadListMemberRow): LeadListMember {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    leadListId: row.leadListId as Id,
    personId: row.personId as Id,
    providerId: row.providerId,
    status: row.status as LeadListMember["status"],
    raw: row.raw,
    provenance: row.provenance,
  };
}

function toOutreachList(row: OutreachListRow): OutreachList {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: row.spaceId as Id,
    name: row.name,
    description: row.description,
    memberPersonIds: row.memberPersonIds as Id[],
  };
}

function toOutreachCampaign(row: OutreachCampaignRow): OutreachCampaign {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spaceId: row.spaceId as Id,
    name: row.name,
    description: row.description,
    listId: row.listId as Id,
    agentId: row.agentId as Id,
    goal: row.goal,
    status: row.status as OutreachCampaign["status"],
    startedAt: row.startedAt,
  };
}

function toOutreachStep(row: OutreachStepRow): OutreachStep {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    campaignId: row.campaignId as Id,
    position: row.position,
    sendAfterDays: row.sendAfterDays,
    channel: row.channel as OutreachStep["channel"],
    subject: row.subject,
    template: row.template,
    instructions: row.instructions,
  };
}

function toOutreachSend(row: OutreachSendRow): OutreachSend {
  return {
    id: row.id as Id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    campaignId: row.campaignId as Id,
    stepId: row.stepId as Id,
    personId: row.personId as Id,
    status: row.status as OutreachSend["status"],
    scheduledAt: row.scheduledAt,
    taskId: (row.taskId as Id | null) ?? null,
    sentAt: row.sentAt,
    error: row.error,
  };
}

const nowIso = () => new Date().toISOString();

interface ChannelAccountRow {
  id: string;
  space_id: string;
  protocol: "telegram" | "matrix";
  label: string;
  identifier: string | null;
  token: string | null;
  status: "offline" | "pairing" | "connecting" | "connected" | "error";
  created_at: string;
  updated_at: string;
}

function toChannelAccount(row: ChannelAccountRow): ChannelAccountRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    protocol: row.protocol,
    label: row.label,
    identifier: row.identifier,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPgRepository(db: Db): JamotRepository {
  const q = db.db;

  const repo: JamotRepository = {
    async createModelProvider(input: NewModelProvider) {
      const [row] = await q
        .insert(modelProviders)
        .values({
          ownerActorId: input.ownerActorId ?? null,
          ownerOrganizationId: input.ownerOrganizationId ?? null,
          name: input.name,
          baseUrl: input.baseUrl,
          credentialRef: input.credentialRef,
        })
        .returning();
      if (!row) throw new Error("failed to create model provider");
      return toModelProviderRecord(row);
    },

    async getModelProvider(id) {
      const [row] = await q
        .select()
        .from(modelProviders)
        .where(eq(modelProviders.id, id))
        .limit(1);
      return row ? toModelProviderRecord(row) : null;
    },

    async listModelProviders(filter) {
      const conditions = [
        filter?.ownerActorId
          ? eq(modelProviders.ownerActorId, filter.ownerActorId)
          : undefined,
        filter?.ownerOrganizationId
          ? eq(modelProviders.ownerOrganizationId, filter.ownerOrganizationId)
          : undefined,
      ].filter(Boolean);
      const rows = await q
        .select()
        .from(modelProviders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(modelProviders.createdAt));
      return rows.map(toModelProviderRecord);
    },

    async updateModelProvider(id, patch) {
      const [row] = await q
        .update(modelProviders)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(modelProviders.id, id))
        .returning();
      return row ? toModelProviderRecord(row) : null;
    },

    async deleteModelProvider(id) {
      await q.delete(providerModels).where(eq(providerModels.providerId, id));
      await q.delete(modelProviders).where(eq(modelProviders.id, id));
    },

    async upsertProviderModel(input) {
      const discovered = input.discovered ?? true;
      const [existingRow] = await q
        .select()
        .from(providerModels)
        .where(
          and(
            eq(providerModels.providerId, input.providerId),
            eq(providerModels.modelId, input.modelId),
          ),
        )
        .limit(1);
      if (existingRow) {
        if (!existingRow.discovered && discovered) {
          const [row] = await q
            .update(providerModels)
            .set({ discovered: true, updatedAt: nowIso() })
            .where(eq(providerModels.id, existingRow.id))
            .returning();
          if (row) return toProviderModelRecord(row);
        }
      return toProviderModelRecord(existingRow);
      }
      const [row] = await q
        .insert(providerModels)
        .values({
          providerId: input.providerId,
          modelId: input.modelId,
          discovered,
        })
        .returning();
      if (!row) throw new Error("failed to upsert provider model");
      return toProviderModelRecord(row);
    },

    async listProviderModels(providerId) {
      const rows = await q
        .select()
        .from(providerModels)
        .where(eq(providerModels.providerId, providerId))
        .orderBy(asc(providerModels.modelId));
      return rows.map(toProviderModelRecord);
    },

    async updateProviderModel(id, patch) {
      const [row] = await q
        .update(providerModels)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(providerModels.id, id))
        .returning();
      return row ? toProviderModelRecord(row) : null;
    },

    async deleteProviderModel(id) {
      await q.delete(providerModels).where(eq(providerModels.id, id));
    },

    async createActor(input: NewActor) {
      const [row] = await q
        .insert(actors)
        .values({
          type: input.type,
          source: input.source ?? "internal",
          displayName: input.displayName,
          status: input.status ?? "active",
          externalIdentities: input.externalIdentities ?? [],
          personalSpaceId: input.personalSpaceId ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create actor");
      return toActor(row);
    },

    async getActor(id) {
      const [row] = await q
        .select()
        .from(actors)
        .where(eq(actors.id, id))
        .limit(1);
      return row ? toActor(row) : null;
    },

    async listActors(filter) {
      if (!filter?.spaceId) {
        const rows = await q.select().from(actors);
        return rows.map(toActor);
      }
      const spaceId = filter.spaceId;
      const members = await q
        .select({ actorId: roles.actorId })
        .from(roles)
        .where(eq(roles.spaceId, spaceId));
      const memberIds = members.map((m) => m.actorId);
      const rows = await q
        .select()
        .from(actors)
        .where(
          or(
            eq(actors.personalSpaceId, spaceId),
            memberIds.length > 0 ? inArray(actors.id, memberIds) : undefined,
          ),
        );
      return rows.map(toActor);
    },

    async updateActor(id, patch) {
      const [row] = await q
        .update(actors)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(actors.id, id))
        .returning();
      return row ? toActor(row) : null;
    },

    async findActorByExternalIdentity(provider, value) {
      const [row] = await q
        .select()
        .from(actors)
        .where(
          sql`${actors.externalIdentities} @> ${JSON.stringify([{ provider, value }])}::jsonb`,
        )
        .limit(1);
      return row ? toActor(row) : null;
    },

    async findPersonByActorId(actorId) {
      const [row] = await q
        .select()
        .from(people)
        .where(eq(people.actorId, actorId))
        .limit(1);
      return row ? toPerson(row) : null;
    },

    async addIdentity(input: NewIdentity) {
      const confidence = input.confidence ?? 1;
      const existing = await repo.findIdentity(input.provider, input.value);
      if (existing) {
        const patch: Partial<
          Pick<Identity, "personId" | "verified" | "confidence" | "source">
        > = {};
        if (input.personId && !existing.personId) patch.personId = input.personId as Id;
        if (input.verified && !existing.verified) patch.verified = true;
        if (confidence > existing.confidence) {
          patch.confidence = confidence;
          if (input.source) patch.source = input.source;
        }
        if (Object.keys(patch).length === 0) return existing;
        const updated = await repo.updateIdentity(existing.id, patch);
        return updated ?? existing;
      }
      const [row] = await q
        .insert(identities)
        .values({
          actorId: input.actorId,
          personId: input.personId ?? null,
          provider: input.provider,
          value: input.value,
          verified: input.verified ?? true,
          confidence,
          source: input.source ?? "observed",
        })
        .returning();
      if (!row) throw new Error("failed to create identity");
      return toIdentity(row);
    },

    async listIdentitiesForActor(actorId) {
      const rows = await q
        .select()
        .from(identities)
        .where(eq(identities.actorId, actorId))
        .orderBy(asc(identities.createdAt));
      return rows.map(toIdentity);
    },

    async listIdentitiesForPerson(personId) {
      const rows = await q
        .select()
        .from(identities)
        .where(eq(identities.personId, personId))
        .orderBy(asc(identities.createdAt));
      return rows.map(toIdentity);
    },

    async findActorByIdentity(provider, value) {
      const identity = await repo.findIdentity(provider, value);
      if (identity) return repo.getActor(identity.actorId);
      return repo.findActorByExternalIdentity(provider, value);
    },

    async findIdentity(provider, value) {
      const [row] = await q
        .select()
        .from(identities)
        .where(and(eq(identities.provider, provider), eq(identities.value, value)))
        .limit(1);
      return row ? toIdentity(row) : null;
    },

    async updateIdentity(id, patch) {
      const [row] = await q
        .update(identities)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(identities.id, id))
        .returning();
      return row ? toIdentity(row) : null;
    },

    async removeIdentity(id) {
      await q.delete(identities).where(eq(identities.id, id));
    },

    async createMergeCandidate(input: NewMergeCandidate) {
      const [row] = await q
        .insert(personMergeCandidates)
        .values({
          spaceId: input.spaceId ?? null,
          personAId: input.personAId,
          personBId: input.personBId,
          reason: input.reason,
          detail: input.detail ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to create merge candidate");
      return toMergeCandidate(row);
    },

    async listMergeCandidates(filter) {
      const where = and(
        filter?.status ? eq(personMergeCandidates.status, filter.status) : undefined,
        filter?.spaceId ? eq(personMergeCandidates.spaceId, filter.spaceId) : undefined,
      );
      const rows = where
        ? await q.select().from(personMergeCandidates).where(where)
        : await q.select().from(personMergeCandidates);
      return rows.map(toMergeCandidate);
    },

    async updateMergeCandidate(id, patch) {
      const [row] = await q
        .update(personMergeCandidates)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(personMergeCandidates.id, id))
        .returning();
      return row ? toMergeCandidate(row) : null;
    },

    async createPerson(input: NewPerson) {
      const [row] = await q
        .insert(people)
        .values({
          actorId: input.actorId,
          email: input.email ?? null,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          phone: input.phone ?? null,
          avatarUrl: input.avatarUrl ?? null,
          avatarSource: input.avatarSource ?? null,
          profile: input.profile ?? {
            selfDescribed: {},
            integral: {},
            skills: [],
            preferences: {},
            goals: [],
          },
          membershipSpaceIds: input.membershipSpaceIds ?? [],
          reputation: input.reputation ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to create person");
      return toPerson(row);
    },

    async getPerson(id) {
      const [row] = await q
        .select()
        .from(people)
        .where(eq(people.id, id))
        .limit(1);
      return row ? toPerson(row) : null;
    },

    async listPeople(filter) {
      const rows = filter?.spaceId
        ? await q
            .select()
            .from(people)
            .where(arrayContains(people.membershipSpaceIds, [filter.spaceId]))
        : await q.select().from(people);
      return rows.map(toPerson);
    },

    async updatePerson(id, patch) {
      const [row] = await q
        .update(people)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(people.id, id))
        .returning();
      return row ? toPerson(row) : null;
    },

    async searchPeople(filter: PeopleFilter) {
      const page = Math.max(1, filter.page ?? 1);
      const perPage = Math.min(200, Math.max(1, filter.perPage ?? 50));

      const conditions = [];
      if (filter.spaceId) {
        conditions.push(arrayContains(people.membershipSpaceIds, [filter.spaceId]));
      }
      if (filter.channel) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM identities i
            WHERE i.person_id = ${people.id} AND i.provider = ${filter.channel}
          )`,
        );
      }
      if (filter.q && filter.q.trim()) {
        const like = `%${filter.q.trim()}%`;
        conditions.push(
          or(
            ilike(people.firstName, like),
            ilike(people.lastName, like),
            ilike(people.email, like),
            ilike(people.phone, like),
            sql`(coalesce(${people.firstName}, '') || ' ' || coalesce(${people.lastName}, '')) ILIKE ${like}`,
          ),
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const orderBy =
        filter.sort === "name"
          ? [
              asc(sql`coalesce(${people.firstName}, '')`),
              asc(sql`coalesce(${people.lastName}, '')`),
            ]
          : filter.sort === "recently_added"
            ? [desc(people.createdAt)]
            : [sql`${people.lastInteractionAt} DESC NULLS LAST`, desc(people.createdAt)];

      const base = q.select().from(people);
      const rows = where
        ? await base.where(where).orderBy(...orderBy).limit(perPage).offset((page - 1) * perPage)
        : await base.orderBy(...orderBy).limit(perPage).offset((page - 1) * perPage);

      const [totalRow] = where
        ? await q.select({ value: count() }).from(people).where(where)
        : await q.select({ value: count() }).from(people);

      return { items: rows.map(toPerson), total: totalRow?.value ?? 0 };
    },

    async findPersonByEmail(email) {
      const [row] = await q
        .select()
        .from(people)
        .where(eq(people.email, email))
        .limit(1);
      return row ? toPerson(row) : null;
    },

    async findPersonByPhone(phone) {
      const [row] = await q
        .select()
        .from(people)
        .where(eq(people.phone, phone))
        .limit(1);
      return row ? toPerson(row) : null;
    },

    async deletePerson(id) {
      await q.delete(people).where(eq(people.id, id));
    },

    async createLeadPerson(input: NewLeadPerson) {
      const [actorRow] = await q
        .insert(actors)
        .values({
          type: "human",
          source: "external",
          displayName: input.displayName,
          status: "active",
          externalIdentities: [],
          personalSpaceId: null,
        })
        .returning();
      if (!actorRow) throw new Error("failed to create lead actor");

      const [personRow] = await q
        .insert(people)
        .values({
          actorId: actorRow.id,
          email: input.email ?? null,
          profile:
            input.profile ?? {
              selfDescribed: {},
              integral: {},
              skills: [],
              preferences: {},
              goals: [],
            },
          membershipSpaceIds: input.membershipSpaceIds ?? [],
          reputation: {},
        })
        .returning();
      if (!personRow) throw new Error("failed to create lead person");
      return toPerson(personRow);
    },

    async createLeadList(input: NewLeadList) {
      const [row] = await q
        .insert(leadLists)
        .values({
          organizationId: input.organizationId ?? null,
          spaceId: input.spaceId,
          createdBy: input.createdBy ?? null,
          name: input.name,
          description: input.description ?? "",
          persona: input.persona ?? { titles: [], seniority: [], functions: [], industries: [], companySizes: [], keywords: [], excludeEmails: [], summary: "" },
          area: input.area ?? null,
          providerId: input.providerId,
          providerConfig: input.providerConfig ?? {},
          status: input.status ?? "draft",
          error: input.error ?? null,
          leadCount: input.leadCount ?? 0,
          lastRunAt: input.lastRunAt ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create lead list");
      return toLeadList(row);
    },

    async getLeadList(id) {
      const [row] = await q
        .select()
        .from(leadLists)
        .where(eq(leadLists.id, id))
        .limit(1);
      return row ? toLeadList(row) : null;
    },

    async listLeadLists(filter) {
      const rows = await q
        .select()
        .from(leadLists)
        .where(
          and(
            filter?.spaceId ? eq(leadLists.spaceId, filter.spaceId) : undefined,
            filter?.organizationId
              ? eq(leadLists.organizationId, filter.organizationId)
              : undefined,
          ),
        )
        .orderBy(desc(leadLists.createdAt));
      return rows.map(toLeadList);
    },

    async updateLeadList(id, patch) {
      const [row] = await q
        .update(leadLists)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(leadLists.id, id))
        .returning();
      return row ? toLeadList(row) : null;
    },

    async deleteLeadList(id) {
      await q.delete(leadLists).where(eq(leadLists.id, id));
    },

    async addLeadListMember(input: NewLeadListMember) {
      const [row] = await q
        .insert(leadListMembers)
        .values({
          leadListId: input.leadListId,
          personId: input.personId,
          providerId: input.providerId,
          status: input.status ?? "new",
          raw: input.raw ?? {},
          provenance: input.provenance ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to add lead list member");
      return toLeadListMember(row);
    },

    async updateLeadListMember(id, patch) {
      const [row] = await q
        .update(leadListMembers)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(leadListMembers.id, id))
        .returning();
      return row ? toLeadListMember(row) : null;
    },

    async listLeadListMembers(leadListId) {
      const rows = await q
        .select()
        .from(leadListMembers)
        .where(eq(leadListMembers.leadListId, leadListId))
        .orderBy(asc(leadListMembers.createdAt));
      return rows.map(toLeadListMember);
    },

    async deleteLeadListMembers(leadListId) {
      await q
        .delete(leadListMembers)
        .where(eq(leadListMembers.leadListId, leadListId));
    },

    async createAgent(input: NewAgent) {
      const [row] = await q
        .insert(agents)
        .values({
          actorId: input.actorId,
          ownerId: input.ownerId,
          organizationIds: input.organizationIds ?? [],
          role: input.role ?? null,
          purpose: input.purpose ?? null,
          description: input.description ?? null,
          harness: input.harness,
          skillIds: input.skillIds ?? [],
          capabilityIds: input.capabilityIds ?? [],
          connectorIds: input.connectorIds ?? [],
          permissions: input.permissions ?? [],
          autonomy: input.autonomy ?? "approve",
          budget: input.budget == null ? null : String(input.budget),
          heartbeat: input.heartbeat ?? {
            enabled: false,
            cron: null,
            quietHours: null,
            check: [],
            onAction: "ask",
          },
          availability: input.availability ?? "offline",
          memoryScopes: input.memoryScopes ?? [],
          subscribedEvents: input.subscribedEvents ?? [],
          schedules: input.schedules ?? [],
          actionPermissions: input.actionPermissions ?? {},
          systemPrompt: input.systemPrompt ?? null,
          model: input.model ?? null,
          performance: input.performance ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to create agent");
      return toAgent(row);
    },

    async getAgent(id) {
      const [row] = await q
        .select()
        .from(agents)
        .where(eq(agents.id, id))
        .limit(1);
      return row ? toAgent(row) : null;
    },

    async listAgents(filter) {
      const rows = await q
        .select()
        .from(agents)
        .where(
          filter?.organizationId
            ? arrayContains(agents.organizationIds, [filter.organizationId])
            : undefined,
        );
      return rows.map(toAgent);
    },

    async updateAgent(id, patch) {
      const { budget, ...rest } = patch;
      const [row] = await q
        .update(agents)
        .set({
          ...rest,
          ...(budget === undefined ? {} : { budget: budget === null ? null : String(budget) }),
          updatedAt: nowIso(),
        })
        .where(eq(agents.id, id))
        .returning();
      return row ? toAgent(row) : null;
    },

    async deleteAgent(id) {
      await q.delete(agents).where(eq(agents.id, id));
    },

    async createRelationship(input) {
      const [row] = await q
        .insert(relationships)
        .values({
          fromActorId: input.fromActorId,
          toActorId: input.toActorId,
          kind: input.kind,
        })
        .returning();
      if (!row) throw new Error("failed to create relationship");
      return toRelationship(row);
    },

    async listRelationshipsForActor(actorId) {
      const rows = await q
        .select()
        .from(relationships)
        .where(or(eq(relationships.fromActorId, actorId), eq(relationships.toActorId, actorId)));
      return rows.map(toRelationship);
    },

    async deleteRelationship(id) {
      await q.delete(relationships).where(eq(relationships.id, id));
    },

    async recordEvent(input) {
      const [row] = await q
        .insert(events)
        .values({
          id: randomUUID(),
          type: input.type,
          spaceId: input.spaceId ?? null,
          actorId: input.actorId ?? null,
          idempotencyKey: randomUUID(),
          payload: input.payload ?? {},
          occurredAt: nowIso(),
          delivered: false,
        })
        .returning();
      if (!row) throw new Error("failed to record event");
      return toEvent(row);
    },

    async listEvents(filter) {
      const conditions = [
        filter?.actorId ? eq(events.actorId, filter.actorId) : undefined,
        filter?.spaceId ? eq(events.spaceId, filter.spaceId) : undefined,
        filter?.since ? gt(events.occurredAt, filter.since) : undefined,
      ].filter(Boolean);
      const rows = await q
        .select()
        .from(events)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(events.occurredAt))
        .limit(filter?.limit ?? 50);
      return rows.map(toEvent);
    },

    async createSpace(input: NewSpace) {
      const [row] = await q
        .insert(spaces)
        .values({
          kind: input.kind,
          ownerActorId: input.ownerActorId,
          name: input.name,
        })
        .returning();
      if (!row) throw new Error("failed to create space");
      return toSpace(row);
    },

    async getSpace(id) {
      const [row] = await q
        .select()
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1);
      return row ? toSpace(row) : null;
    },

    async getSpaceSettings(spaceId: string): Promise<Record<string, unknown>> {
      const [row] = await q
        .select()
        .from(spaceSettings)
        .where(eq(spaceSettings.spaceId, spaceId))
        .limit(1);
      return (row?.config as Record<string, unknown>) ?? {};
    },

    async setSpaceSettings(
      spaceId: string,
      patch: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
      const current = await this.getSpaceSettings(spaceId);
      const next = { ...current, ...patch };
      const [row] = await q
        .insert(spaceSettings)
        .values({ spaceId: spaceId as Id, config: next })
        .onConflictDoUpdate({
          target: spaceSettings.spaceId,
          set: { config: next, updatedAt: nowIso() },
        })
        .returning();
      return (row?.config as Record<string, unknown>) ?? next;
    },

    async listSpaces() {
      const rows = await q.select().from(spaces);
      return rows.map(toSpace);
    },

    async updateSpace(id, patch) {
      const [row] = await q
        .update(spaces)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(spaces.id, id))
        .returning();
      return row ? toSpace(row) : null;
    },

    async createOrganization(input: NewOrganization) {
      const [row] = await q
        .insert(organizations)
        .values({
          spaceId: input.spaceId,
          slug: input.slug ?? null,
          logoUrl: input.logoUrl ?? null,
          dream: input.dream ?? "",
          blueprint: input.blueprint ?? {},
          enabledAppIds: input.enabledAppIds ?? [],
          treasuryId: input.treasuryId ?? null,
          reputation: input.reputation ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to create organization");
      return toOrganization(row);
    },

    async getOrganization(id) {
      const [row] = await q
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
      return row ? toOrganization(row) : null;
    },

    async getOrganizationBySlug(slug) {
      const [row] = await q
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      return row ? toOrganization(row) : null;
    },

    async listOrganizations() {
      const rows = await q.select().from(organizations);
      return rows.map(toOrganization);
    },

    async createWorkspace(input) {
      const [row] = await q
        .insert(workspaces)
        .values({
          organizationId: input.organizationId,
          spaceId: input.spaceId,
          name: input.name,
          config: input.config ?? {},
        })
        .returning();
      if (!row) throw new Error("failed to create workspace");
      return toWorkspace(row);
    },

    async getWorkspace(id) {
      const [row] = await q
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .limit(1);
      return row ? toWorkspace(row) : null;
    },

    async listWorkspaces(organizationId) {
      const rows = await q
        .select()
        .from(workspaces)
        .where(eq(workspaces.organizationId, organizationId));
      return rows.map(toWorkspace);
    },

    async getOrganizationBySpaceId(spaceId) {
      const [ws] = await q
        .select()
        .from(workspaces)
        .where(eq(workspaces.spaceId, spaceId))
        .limit(1);
      if (!ws) return null;
      return this.getOrganization(ws.organizationId);
    },

    async updateWorkspace(id, patch) {
      const [row] = await q
        .update(workspaces)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(workspaces.id, id))
        .returning();
      return row ? toWorkspace(row) : null;
    },

    async deleteWorkspace(id) {
      await q.delete(workspaces).where(eq(workspaces.id, id));
    },

    async deleteOrganizationCascade(id) {
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        const orgRows = await client.query(
          `SELECT id, space_id FROM organizations WHERE id = $1::uuid`,
          [id],
        );
        if ((orgRows.rowCount ?? 0) === 0) {
          await client.query("ROLLBACK");
          return;
        }
        const primarySpaceId = orgRows.rows[0]!.space_id as string;
        const wsRows = await client.query(
          `SELECT space_id FROM workspaces WHERE organization_id = $1::uuid`,
          [id],
        );
        const spaceIds = [
          primarySpaceId,
          ...wsRows.rows.map((r) => r.space_id as string),
        ];

        const $1 = id;
        const $2 = spaceIds;

        await client.query(
          `DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE space_id = ANY($2::uuid[]))`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE space_id = ANY($2::uuid[]))`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM payment_records WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM payment_intents WHERE space_id = ANY($2::uuid[]) OR buyer_organization_id = $1::uuid OR seller_organization_id = $1::uuid`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM purchase_orders WHERE space_id = ANY($2::uuid[]) OR buyer_organization_id = $1::uuid OR seller_organization_id = $1::uuid`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM quotes WHERE space_id = ANY($2::uuid[]) OR seller_organization_id = $1::uuid`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM quote_requests WHERE space_id = ANY($2::uuid[]) OR buyer_organization_id = $1::uuid`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM buyer_agreements WHERE buyer_organization_id = $1::uuid OR catalog_offer_id IN (SELECT id FROM catalog_offers WHERE seller_organization_id = $1::uuid OR space_id = ANY($2::uuid[]))`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM catalog_offers WHERE seller_organization_id = $1::uuid OR space_id = ANY($2::uuid[]) OR catalog_id IN (SELECT id FROM catalogs WHERE owner_organization_id = $1::uuid)`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM catalogs WHERE owner_organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM product_variants WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM product_base WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM conversations WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM channels WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM wa_accounts WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM knowledge_edges WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM knowledge_entities WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM tasks WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM task_lists WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM projects WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM goals WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM capabilities WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM policies WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM events WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM audit_log WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM memories WHERE owner_id = $1::uuid OR owner_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM secrets WHERE owner_organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM skills WHERE owner_organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM connectors WHERE owner_organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM composio_oauth_states WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `UPDATE agents SET organization_ids = array_remove(organization_ids, $1::uuid), updated_at = now() WHERE $1::uuid = ANY(organization_ids)`,
          [$1],
        );
        await client.query(
          `DELETE FROM agents WHERE organization_ids = '{}'::uuid[]`,
        );
        await client.query(
          `DELETE FROM positions WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM organic_charts WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM suppliers WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM treasury_ledger WHERE account_id IN (SELECT id FROM treasury_accounts WHERE organization_id = $1::uuid)`,
          [$1],
        );
        await client.query(
          `DELETE FROM treasury_accounts WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM treasury_proposals WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM contribution_credits WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM distribution_rules WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM roles WHERE space_id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `UPDATE people SET membership_space_ids = ARRAY(SELECT x FROM unnest(membership_space_ids) AS x WHERE NOT (x = ANY($2::uuid[]))) WHERE membership_space_ids && $2::uuid[]`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM workspaces WHERE organization_id = $1::uuid`,
          [$1],
        );
        await client.query(
          `DELETE FROM spaces WHERE id = ANY($2::uuid[])`,
          [$1, $2],
        );
        await client.query(
          `DELETE FROM organizations WHERE id = $1::uuid`,
          [$1],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async updateOrganization(id, patch) {
      const [row] = await q
        .update(organizations)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(organizations.id, id))
        .returning();
      return row ? toOrganization(row) : null;
    },

    async createRole(input: NewRole) {
      const [row] = await q
        .insert(roles)
        .values({
          actorId: input.actorId,
          spaceId: input.spaceId,
          kind: input.kind,
          title: input.title ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create role");
      return toRole(row);
    },

    async listRolesForActor(actorId) {
      const rows = await q
        .select()
        .from(roles)
        .where(eq(roles.actorId, actorId));
      return rows.map(toRole);
    },

    async listRolesForSpace(spaceId) {
      const rows = await q
        .select()
        .from(roles)
        .where(eq(roles.spaceId, spaceId));
      return rows.map(toRole);
    },

    async updateRole(id, patch) {
      const [row] = await q
        .update(roles)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(roles.id, id))
        .returning();
      return row ? toRole(row) : null;
    },

    async deleteRole(id) {
      await q.delete(roles).where(eq(roles.id, id));
    },

    async createTask(input: NewTask) {
      const [row] = await q
        .insert(tasks)
        .values({
          spaceId: input.spaceId,
          projectId: input.projectId ?? null,
          listId: input.listId ?? null,
          title: input.title,
          description: input.description ?? "",
          status: input.status ?? "created",
          assigneeActorIds: input.assigneeActorIds ?? [],
          targetType: input.targetType ?? "human",
          requiredCapabilityIds: input.requiredCapabilityIds ?? [],
          outcome: input.outcome ?? null,
          dueDate: input.dueDate ?? null,
          position: input.position ?? 0,
        })
        .returning();
      if (!row) throw new Error("failed to create task");
      return toTask(row);
    },

    async getTask(id) {
      const [row] = await q
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      return row ? toTask(row) : null;
    },

    async listTasks(filter) {
      const rows = await q
        .select()
        .from(tasks)
        .where(
          and(
            filter?.spaceId ? eq(tasks.spaceId, filter.spaceId) : undefined,
            filter?.listId ? eq(tasks.listId, filter.listId) : undefined,
            filter?.assigneeActorId
              ? arrayContains(tasks.assigneeActorIds, [filter.assigneeActorId])
              : undefined,
          ),
        );
      return rows.map(toTask);
    },

    async updateTaskStatus(id, status) {
      const [row] = await q
        .update(tasks)
        .set({ status, updatedAt: nowIso() })
        .where(eq(tasks.id, id))
        .returning();
      return row ? toTask(row) : null;
    },

    async assignTask(id, assigneeActorIds) {
      const [row] = await q
        .update(tasks)
        .set({ assigneeActorIds, updatedAt: nowIso() })
        .where(eq(tasks.id, id))
        .returning();
      return row ? toTask(row) : null;
    },

    async updateTask(id, patch) {
      const [row] = await q
        .update(tasks)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(tasks.id, id))
        .returning();
      return row ? toTask(row) : null;
    },

    async createTaskList(input: NewTaskList) {
      const [row] = await q
        .insert(taskLists)
        .values({
          spaceId: input.spaceId,
          name: input.name,
          position: input.position ?? 0,
        })
        .returning();
      if (!row) throw new Error("failed to create task list");
      return toTaskList(row);
    },

    async getTaskList(id) {
      const [row] = await q
        .select()
        .from(taskLists)
        .where(eq(taskLists.id, id))
        .limit(1);
      return row ? toTaskList(row) : null;
    },

    async listTaskLists(spaceId) {
      const rows = await q
        .select()
        .from(taskLists)
        .where(eq(taskLists.spaceId, spaceId))
        .orderBy(asc(taskLists.position));
      return rows.map(toTaskList);
    },

    async updateTaskList(id, patch) {
      const [row] = await q
        .update(taskLists)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(taskLists.id, id))
        .returning();
      return row ? toTaskList(row) : null;
    },

    async deleteTaskList(id) {
      await q.delete(taskLists).where(eq(taskLists.id, id));
    },

    async addTaskAttachment(input: NewTaskAttachment) {
      const [row] = await q
        .insert(taskAttachments)
        .values({
          taskId: input.taskId,
          name: input.name,
          mimeType: input.mimeType ?? "application/octet-stream",
          size: input.size ?? 0,
          data: input.data,
        })
        .returning();
      if (!row) throw new Error("failed to add task attachment");
      return toTaskAttachment(row);
    },

    async listTaskAttachments(taskId) {
      const rows = await q
        .select()
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, taskId));
      return rows.map(toTaskAttachment);
    },

    async deleteTaskAttachment(id) {
      await q.delete(taskAttachments).where(eq(taskAttachments.id, id));
    },

    async createSkill(input: NewSkill) {
      const [row] = await q
        .insert(skills)
        .values({
          ownerActorId: input.ownerActorId ?? null,
          ownerOrganizationId: input.ownerOrganizationId ?? null,
          name: input.name,
          description: input.description ?? "",
          body: input.body ?? "",
          version: input.version ?? "1.0.0",
          inputs: input.inputs ?? {},
          outputs: input.outputs ?? {},
          prerequisites: input.prerequisites ?? [],
          allowedCapabilityIds: input.allowedCapabilityIds ?? [],
          evaluationCriteria: input.evaluationCriteria ?? [],
          provenance: input.provenance,
          status: input.status ?? "draft",
        })
        .returning();
      if (!row) throw new Error("failed to create skill");
      return toSkill(row);
    },

    async getSkill(id) {
      const [row] = await q
        .select()
        .from(skills)
        .where(eq(skills.id, id))
        .limit(1);
      return row ? toSkill(row) : null;
    },

    async listSkills(filter) {
      const rows = await q
        .select()
        .from(skills)
        .where(
          filter?.ownerOrganizationId
            ? eq(skills.ownerOrganizationId, filter.ownerOrganizationId)
            : undefined,
        );
      return rows.map(toSkill);
    },

    async updateSkill(id, patch) {
      const [row] = await q
        .update(skills)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(skills.id, id))
        .returning();
      return row ? toSkill(row) : null;
    },

    async deleteSkill(id) {
      await q.delete(skills).where(eq(skills.id, id));
    },

    async createConnector(input: NewConnector) {
      const [row] = await q
        .insert(connectors)
        .values({
          provider: input.provider,
          type: input.type ?? "channel",
          ownerActorId: input.ownerActorId ?? null,
          ownerOrganizationId: input.ownerOrganizationId ?? null,
          sharing: input.sharing ?? "user",
          capabilities: input.capabilities ?? [],
          credentialRef: input.credentialRef,
          scopes: input.scopes ?? [],
          configuration: input.configuration ?? {},
          status: input.status ?? "disconnected",
        })
        .returning();
      if (!row) throw new Error("failed to create connector");
      return toConnector(row);
    },

    async getConnector(id) {
      const [row] = await q
        .select()
        .from(connectors)
        .where(eq(connectors.id, id))
        .limit(1);
      return row ? toConnector(row) : null;
    },

    async listConnectors(filter) {
      const rows = await q
        .select()
        .from(connectors)
        .where(
          filter?.ownerOrganizationId
            ? eq(connectors.ownerOrganizationId, filter.ownerOrganizationId)
            : undefined,
        );
      return rows.map(toConnector);
    },

    async updateConnectorStatus(id, status) {
      const [row] = await q
        .update(connectors)
        .set({ status, updatedAt: nowIso() })
        .where(eq(connectors.id, id))
        .returning();
      return row ? toConnector(row) : null;
    },

    async updateConnector(id, patch) {
      const [row] = await q
        .update(connectors)
        .set({
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.configuration !== undefined ? { configuration: patch.configuration } : {}),
          ...(patch.sharing !== undefined ? { sharing: patch.sharing } : {}),
          updatedAt: nowIso(),
        })
        .where(eq(connectors.id, id))
        .returning();
      return row ? toConnector(row) : null;
    },

    async deleteConnector(id) {
      await q.delete(connectors).where(eq(connectors.id, id));
    },

    async putComposioOAuthState(input) {
      const [row] = await q
        .insert(composioOauthStates)
        .values({
          state: input.state,
          actorId: input.actorId,
          organizationId: input.organizationId ?? null,
          sharing: input.sharing,
          toolkit: input.toolkit,
          composioUserId: input.composioUserId,
          apiKeyScope: input.apiKeyScope,
          redirectUri: input.redirectUri,
          consumed: input.consumed,
          expiresAt: input.expiresAt,
        })
        .returning();
      if (!row) throw new Error("failed to create composio oauth state");
      return toComposioOAuthState(row);
    },

    async getComposioOAuthState(state) {
      const [row] = await q
        .select()
        .from(composioOauthStates)
        .where(eq(composioOauthStates.state, state))
        .limit(1);
      return row ? toComposioOAuthState(row) : null;
    },

    async consumeComposioOAuthState(state) {
      const [row] = await q
        .update(composioOauthStates)
        .set({ consumed: true, updatedAt: nowIso() })
        .where(eq(composioOauthStates.state, state))
        .returning();
      return row ? toComposioOAuthState(row) : null;
    },

    async createCapability(input: NewCapability) {
      const [row] = await q
        .insert(capabilities)
        .values({
          name: input.name,
          skillId: input.skillId,
          connectorId: input.connectorId,
          policyIds: input.policyIds ?? [],
          context: input.context ?? {},
          spaceId: input.spaceId,
        })
        .returning();
      if (!row) throw new Error("failed to create capability");
      return toCapability(row);
    },

    async getCapability(id) {
      const [row] = await q
        .select()
        .from(capabilities)
        .where(eq(capabilities.id, id))
        .limit(1);
      return row ? toCapability(row) : null;
    },

    async listCapabilities(filter) {
      const rows = await q
        .select()
        .from(capabilities)
        .where(
          filter?.spaceId ? eq(capabilities.spaceId, filter.spaceId) : undefined,
        );
      return rows.map(toCapability);
    },

    async createPolicy(input: NewPolicy) {
      const [row] = await q
        .insert(policies)
        .values({
          spaceId: input.spaceId,
          name: input.name,
          capability: input.capability,
          resource: input.resource ?? "*",
          minRole: input.minRole ?? null,
          riskThreshold: String(input.riskThreshold ?? 0.5),
          decision: input.decision,
        })
        .returning();
      if (!row) throw new Error("failed to create policy");
      return toPolicy(row);
    },

    async listPolicies(filter) {
      const rows = await q
        .select()
        .from(policies)
        .where(
          filter?.spaceId ? eq(policies.spaceId, filter.spaceId) : undefined,
        );
      return rows.map(toPolicy);
    },

    async putSecret(secret) {
      await q
        .insert(secrets)
        .values({
          ref: secret.ref,
          scope: secret.scope,
          ownerActorId: secret.ownerActorId ?? null,
          ownerOrganizationId: secret.ownerOrganizationId ?? null,
          ciphertext: secret.ciphertext,
        })
        .onConflictDoUpdate({
          target: secrets.ref,
          set: {
            scope: secret.scope,
            ownerActorId: secret.ownerActorId ?? null,
            ownerOrganizationId: secret.ownerOrganizationId ?? null,
            ciphertext: secret.ciphertext,
            updatedAt: nowIso(),
          },
        });
    },

    async getSecret(ref) {
      const [row] = await q
        .select()
        .from(secrets)
        .where(eq(secrets.ref, ref))
        .limit(1);
      return row ? toSecret(row) : null;
    },

    async deleteSecret(ref) {
      await q.delete(secrets).where(eq(secrets.ref, ref));
    },

    async createSupplier(input: NewSupplier) {
      const [row] = await q
        .insert(suppliers)
        .values({
          actorId: input.actorId,
          organizationId: input.organizationId ?? null,
          onboardingStatus: input.onboardingStatus ?? "active",
          defaultCurrency: input.defaultCurrency ?? "USD",
          terms: input.terms ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create supplier");
      return toSupplier(row);
    },

    async getSupplier(id) {
      const [row] = await q
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);
      return row ? toSupplier(row) : null;
    },

    async getSupplierByActor(actorId) {
      const [row] = await q
        .select()
        .from(suppliers)
        .where(eq(suppliers.actorId, actorId))
        .limit(1);
      return row ? toSupplier(row) : null;
    },

    async listSuppliers(filter) {
      const rows = await q
        .select()
        .from(suppliers)
        .where(filter?.organizationId ? eq(suppliers.organizationId, filter.organizationId) : undefined);
      return rows.map(toSupplier);
    },

    async updateSupplier(id, patch) {
      const [row] = await q
        .update(suppliers)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(suppliers.id, id))
        .returning();
      return row ? toSupplier(row) : null;
    },

    async createProduct(input: NewProduct) {
      const [row] = await q
        .insert(productBase)
        .values({
          spaceId: input.spaceId ?? null,
          gtin: input.gtin ?? null,
          sku: input.sku ?? null,
          manufacturerId: input.manufacturerId ?? null,
          name: input.name,
          description: input.description ?? "",
          dimensions: input.dimensions ?? null,
          packaging: input.packaging ?? null,
          unitOfMeasure: input.unitOfMeasure ?? "each",
          taxCategory: input.taxCategory ?? null,
          compliance: input.compliance ?? [],
          lifecycle: input.lifecycle ?? "draft",
        })
        .returning();
      if (!row) throw new Error("failed to create product");
      return toProduct(row);
    },

    async getProduct(id) {
      const [row] = await q
        .select()
        .from(productBase)
        .where(eq(productBase.id, id))
        .limit(1);
      return row ? toProduct(row) : null;
    },

    async listProducts(filter) {
      const rows = filter?.spaceId
        ? await q
            .select()
            .from(productBase)
            .where(eq(productBase.spaceId, filter.spaceId))
        : await q.select().from(productBase);
      return rows.map(toProduct);
    },

    async createCatalog(input: NewCatalog) {
      const [row] = await q
        .insert(catalogs)
        .values({
          ownerOrganizationId: input.ownerOrganizationId,
          name: input.name,
          version: input.version ?? "1.0.0",
          visibility: input.visibility ?? "private",
          source: input.source ?? "native",
          sourceOfTruth: input.sourceOfTruth ?? "server",
          syncRef: input.syncRef ?? null,
          lastSyncAt: input.lastSyncAt ?? null,
          status: input.status ?? "draft",
        })
        .returning();
      if (!row) throw new Error("failed to create catalog");
      return toCatalog(row);
    },

    async getCatalog(id) {
      const [row] = await q
        .select()
        .from(catalogs)
        .where(eq(catalogs.id, id))
        .limit(1);
      return row ? toCatalog(row) : null;
    },

    async listCatalogs(filter) {
      const rows = await q
        .select()
        .from(catalogs)
        .where(filter?.ownerOrganizationId ? eq(catalogs.ownerOrganizationId, filter.ownerOrganizationId) : undefined)
        .orderBy(asc(catalogs.createdAt));
      return rows.map(toCatalog);
    },

    async updateCatalog(id, patch) {
      const [row] = await q
        .update(catalogs)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(catalogs.id, id))
        .returning();
      return row ? toCatalog(row) : null;
    },

    async createCatalogOffer(input: NewCatalogOffer) {
      const [row] = await q
        .insert(catalogOffers)
        .values({
          catalogId: input.catalogId,
          productId: input.productId,
          sellerOrganizationId: input.sellerOrganizationId,
          spaceId: input.spaceId ?? null,
          orderableUnit: input.orderableUnit ?? "each",
          priceQuantity: input.priceQuantity ?? 1,
          priceTiers: input.priceTiers,
          minQty: input.minQty ?? 0,
          maxQty: input.maxQty ?? null,
          orderIncrement: input.orderIncrement ?? 1,
          availability: input.availability ?? null,
          leadTime: input.leadTime ?? null,
          validityFrom: input.validityFrom ?? null,
          validityTo: input.validityTo ?? null,
          taxIncluded: input.taxIncluded ?? false,
          status: input.status ?? "active",
        })
        .returning();
      if (!row) throw new Error("failed to create catalog offer");
      return toCatalogOffer(row);
    },

    async getCatalogOffer(id) {
      const [row] = await q
        .select()
        .from(catalogOffers)
        .where(eq(catalogOffers.id, id))
        .limit(1);
      return row ? toCatalogOffer(row) : null;
    },

    async listCatalogOffers(filter) {
      const rows = await q
        .select()
        .from(catalogOffers)
        .where(
          and(
            filter?.catalogId ? eq(catalogOffers.catalogId, filter.catalogId) : undefined,
            filter?.sellerOrganizationId
              ? eq(catalogOffers.sellerOrganizationId, filter.sellerOrganizationId)
              : undefined,
            filter?.spaceId ? eq(catalogOffers.spaceId, filter.spaceId) : undefined,
          ),
        )
        .orderBy(asc(catalogOffers.createdAt));
      return rows.map(toCatalogOffer);
    },

    async updateCatalogOffer(id, patch) {
      const [row] = await q
        .update(catalogOffers)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(catalogOffers.id, id))
        .returning();
      return row ? toCatalogOffer(row) : null;
    },

    async createBuyerAgreement(input: NewBuyerAgreement) {
      const [row] = await q
        .insert(buyerAgreements)
        .values({
          catalogOfferId: input.catalogOfferId,
          buyerOrganizationId: input.buyerOrganizationId,
          priceTiers: input.priceTiers,
          validityFrom: input.validityFrom ?? null,
          validityTo: input.validityTo ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create buyer agreement");
      return toBuyerAgreement(row);
    },

    async listBuyerAgreements(filter) {
      const rows = await q
        .select()
        .from(buyerAgreements)
        .where(
          and(
            filter?.catalogOfferId ? eq(buyerAgreements.catalogOfferId, filter.catalogOfferId) : undefined,
            filter?.buyerOrganizationId
              ? eq(buyerAgreements.buyerOrganizationId, filter.buyerOrganizationId)
              : undefined,
          ),
        );
      return rows.map(toBuyerAgreement);
    },

    async createQuoteRequest(input: NewQuoteRequest) {
      const [row] = await q
        .insert(quoteRequests)
        .values({
          buyerOrganizationId: input.buyerOrganizationId,
          spaceId: input.spaceId ?? null,
          title: input.title,
          description: input.description ?? "",
          items: input.items,
          status: input.status ?? "open",
          responseDeadline: input.responseDeadline ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create quote request");
      return toQuoteRequest(row);
    },

    async getQuoteRequest(id) {
      const [row] = await q
        .select()
        .from(quoteRequests)
        .where(eq(quoteRequests.id, id))
        .limit(1);
      return row ? toQuoteRequest(row) : null;
    },

    async listQuoteRequests(filter) {
      const rows = await q
        .select()
        .from(quoteRequests)
        .where(
          and(
            filter?.buyerOrganizationId
              ? eq(quoteRequests.buyerOrganizationId, filter.buyerOrganizationId)
              : undefined,
            filter?.spaceId ? eq(quoteRequests.spaceId, filter.spaceId) : undefined,
          ),
        )
        .orderBy(asc(quoteRequests.createdAt));
      return rows.map(toQuoteRequest);
    },

    async updateQuoteRequestStatus(id, status) {
      const [row] = await q
        .update(quoteRequests)
        .set({ status, updatedAt: nowIso() })
        .where(eq(quoteRequests.id, id))
        .returning();
      return row ? toQuoteRequest(row) : null;
    },

    async createQuote(input: NewQuote) {
      const [row] = await q
        .insert(quotes)
        .values({
          quoteRequestId: input.quoteRequestId,
          sellerOrganizationId: input.sellerOrganizationId,
          spaceId: input.spaceId ?? null,
          items: input.items,
          total: String(input.total),
          currency: input.currency ?? "USD",
          terms: input.terms ?? null,
          status: input.status ?? "submitted",
          transcript: input.transcript ?? [],
          validUntil: input.validUntil ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create quote");
      return toQuote(row);
    },

    async getQuote(id) {
      const [row] = await q
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      return row ? toQuote(row) : null;
    },

    async listQuotes(filter) {
      const rows = await q
        .select()
        .from(quotes)
        .where(filter?.quoteRequestId ? eq(quotes.quoteRequestId, filter.quoteRequestId) : undefined)
        .orderBy(asc(quotes.createdAt));
      return rows.map(toQuote);
    },

    async updateQuoteStatus(id, status) {
      const [row] = await q
        .update(quotes)
        .set({ status, updatedAt: nowIso() })
        .where(eq(quotes.id, id))
        .returning();
      return row ? toQuote(row) : null;
    },

    async appendQuoteTranscript(id, message) {
      const [existing] = await q
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1);
      if (!existing) return null;
      const [row] = await q
        .update(quotes)
        .set({
          transcript: [...(existing.transcript ?? []), message],
          updatedAt: nowIso(),
        })
        .where(eq(quotes.id, id))
        .returning();
      return row ? toQuote(row) : null;
    },

    async createPurchaseOrder(input: NewPurchaseOrder) {
      const [row] = await q
        .insert(purchaseOrders)
        .values({
          quoteId: input.quoteId,
          buyerOrganizationId: input.buyerOrganizationId,
          sellerOrganizationId: input.sellerOrganizationId,
          spaceId: input.spaceId ?? null,
          items: input.items,
          total: String(input.total),
          currency: input.currency ?? "USD",
          status: input.status ?? "pending_approval",
        })
        .returning();
      if (!row) throw new Error("failed to create purchase order");
      return toPurchaseOrder(row);
    },

    async getPurchaseOrder(id) {
      const [row] = await q
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);
      return row ? toPurchaseOrder(row) : null;
    },

    async listPurchaseOrders(filter) {
      const rows = await q
        .select()
        .from(purchaseOrders)
        .where(
          and(
            filter?.buyerOrganizationId
              ? eq(purchaseOrders.buyerOrganizationId, filter.buyerOrganizationId)
              : undefined,
            filter?.sellerOrganizationId
              ? eq(purchaseOrders.sellerOrganizationId, filter.sellerOrganizationId)
              : undefined,
            filter?.spaceId ? eq(purchaseOrders.spaceId, filter.spaceId) : undefined,
          ),
        )
        .orderBy(asc(purchaseOrders.createdAt));
      return rows.map(toPurchaseOrder);
    },

    async updatePurchaseOrder(id, patch) {
      const [row] = await q
        .update(purchaseOrders)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(purchaseOrders.id, id))
        .returning();
      return row ? toPurchaseOrder(row) : null;
    },

    async createPaymentIntent(input: NewPaymentIntent) {
      const [row] = await q
        .insert(paymentIntents)
        .values({
          purchaseOrderId: input.purchaseOrderId,
          buyerOrganizationId: input.buyerOrganizationId,
          sellerOrganizationId: input.sellerOrganizationId,
          spaceId: input.spaceId ?? null,
          currency: input.currency ?? "USD",
          estimatedAmount: String(input.estimatedAmount),
          status: input.status ?? "draft",
          provider: input.provider ?? "ledger",
          requiresApproval: input.requiresApproval ?? true,
          approvedByActorId: input.approvedByActorId ?? null,
          providerReference: input.providerReference ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create payment intent");
      return toPaymentIntent(row);
    },

    async getPaymentIntent(id) {
      const [row] = await q
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, id))
        .limit(1);
      return row ? toPaymentIntent(row) : null;
    },

    async listPaymentIntents(filter) {
      const rows = await q
        .select()
        .from(paymentIntents)
        .where(
          and(
            filter?.buyerOrganizationId
              ? eq(paymentIntents.buyerOrganizationId, filter.buyerOrganizationId)
              : undefined,
            filter?.sellerOrganizationId
              ? eq(paymentIntents.sellerOrganizationId, filter.sellerOrganizationId)
              : undefined,
            filter?.purchaseOrderId
              ? eq(paymentIntents.purchaseOrderId, filter.purchaseOrderId)
              : undefined,
            filter?.spaceId ? eq(paymentIntents.spaceId, filter.spaceId) : undefined,
          ),
        )
        .orderBy(asc(paymentIntents.createdAt));
      return rows.map(toPaymentIntent);
    },

    async updatePaymentIntent(id, patch) {
      const [row] = await q
        .update(paymentIntents)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(paymentIntents.id, id))
        .returning();
      return row ? toPaymentIntent(row) : null;
    },

    async createPaymentRecord(input: NewPaymentRecord) {
      const [row] = await q
        .insert(paymentRecords)
        .values({
          paymentIntentId: input.paymentIntentId,
          spaceId: input.spaceId ?? null,
          paidAmount: String(input.paidAmount),
          currency: input.currency ?? "USD",
          providerReference: input.providerReference ?? null,
          settledAt: input.settledAt ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create payment record");
      return toPaymentRecord(row);
    },

    async listPaymentRecords(paymentIntentId) {
      const rows = await q
        .select()
        .from(paymentRecords)
        .where(eq(paymentRecords.paymentIntentId, paymentIntentId))
        .orderBy(asc(paymentRecords.createdAt));
      return rows.map(toPaymentRecord);
    },

    async createOutreachList(input: NewOutreachList) {
      const [row] = await q
        .insert(outreachLists)
        .values({
          spaceId: input.spaceId,
          name: input.name,
          description: input.description ?? "",
          memberPersonIds: input.memberPersonIds ?? [],
        })
        .returning();
      if (!row) throw new Error("failed to create outreach list");
      return toOutreachList(row);
    },

    async getOutreachList(id) {
      const [row] = await q
        .select()
        .from(outreachLists)
        .where(eq(outreachLists.id, id))
        .limit(1);
      return row ? toOutreachList(row) : null;
    },

    async listOutreachLists(spaceId) {
      const rows = await q
        .select()
        .from(outreachLists)
        .where(eq(outreachLists.spaceId, spaceId))
        .orderBy(asc(outreachLists.createdAt));
      return rows.map(toOutreachList);
    },

    async updateOutreachList(id, patch) {
      const [row] = await q
        .update(outreachLists)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(outreachLists.id, id))
        .returning();
      return row ? toOutreachList(row) : null;
    },

    async deleteOutreachList(id) {
      await q.delete(outreachLists).where(eq(outreachLists.id, id));
    },

    async createOutreachCampaign(input: NewOutreachCampaign) {
      const [row] = await q
        .insert(outreachCampaigns)
        .values({
          spaceId: input.spaceId,
          name: input.name,
          description: input.description ?? "",
          listId: input.listId,
          agentId: input.agentId,
          goal: input.goal,
          status: input.status ?? "draft",
          startedAt: input.startedAt ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create outreach campaign");
      return toOutreachCampaign(row);
    },

    async getOutreachCampaign(id) {
      const [row] = await q
        .select()
        .from(outreachCampaigns)
        .where(eq(outreachCampaigns.id, id))
        .limit(1);
      return row ? toOutreachCampaign(row) : null;
    },

    async listOutreachCampaigns(filter) {
      const rows = await q
        .select()
        .from(outreachCampaigns)
        .where(
          and(
            filter?.spaceId
              ? eq(outreachCampaigns.spaceId, filter.spaceId)
              : undefined,
            filter?.status
              ? eq(outreachCampaigns.status, filter.status)
              : undefined,
          ),
        )
        .orderBy(desc(outreachCampaigns.createdAt));
      return rows.map(toOutreachCampaign);
    },

    async updateOutreachCampaign(id, patch) {
      const [row] = await q
        .update(outreachCampaigns)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(outreachCampaigns.id, id))
        .returning();
      return row ? toOutreachCampaign(row) : null;
    },

    async deleteOutreachCampaign(id) {
      await q.delete(outreachCampaigns).where(eq(outreachCampaigns.id, id));
    },

    async createOutreachStep(input: NewOutreachStep) {
      const [row] = await q
        .insert(outreachSteps)
        .values({
          campaignId: input.campaignId,
          position: input.position ?? 0,
          sendAfterDays: input.sendAfterDays ?? 0,
          channel: input.channel ?? "whatsapp",
          subject: input.subject ?? "",
          template: input.template ?? "",
          instructions: input.instructions ?? "",
        })
        .returning();
      if (!row) throw new Error("failed to create outreach step");
      return toOutreachStep(row);
    },

    async listOutreachSteps(campaignId) {
      const rows = await q
        .select()
        .from(outreachSteps)
        .where(eq(outreachSteps.campaignId, campaignId))
        .orderBy(asc(outreachSteps.position));
      return rows.map(toOutreachStep);
    },

    async updateOutreachStep(id, patch) {
      const [row] = await q
        .update(outreachSteps)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(outreachSteps.id, id))
        .returning();
      return row ? toOutreachStep(row) : null;
    },

    async deleteOutreachStep(id) {
      await q.delete(outreachSteps).where(eq(outreachSteps.id, id));
    },

    async createOutreachSend(input: NewOutreachSend) {
      const [row] = await q
        .insert(outreachSends)
        .values({
          campaignId: input.campaignId,
          stepId: input.stepId,
          personId: input.personId,
          status: input.status ?? "queued",
          scheduledAt: input.scheduledAt,
          taskId: input.taskId ?? null,
          sentAt: input.sentAt ?? null,
          error: input.error ?? null,
        })
        .returning();
      if (!row) throw new Error("failed to create outreach send");
      return toOutreachSend(row);
    },

    async getOutreachSend(id) {
      const [row] = await q
        .select()
        .from(outreachSends)
        .where(eq(outreachSends.id, id))
        .limit(1);
      return row ? toOutreachSend(row) : null;
    },

    async findOutreachSend(campaignId, stepId, personId) {
      const [row] = await q
        .select()
        .from(outreachSends)
        .where(
          and(
            eq(outreachSends.campaignId, campaignId),
            eq(outreachSends.stepId, stepId),
            eq(outreachSends.personId, personId),
          ),
        )
        .limit(1);
      return row ? toOutreachSend(row) : null;
    },

    async listOutreachSends(filter) {
      const rows = await q
        .select()
        .from(outreachSends)
        .where(
          and(
            filter?.campaignId
              ? eq(outreachSends.campaignId, filter.campaignId)
              : undefined,
            filter?.personId
              ? eq(outreachSends.personId, filter.personId)
              : undefined,
          ),
        )
        .orderBy(asc(outreachSends.scheduledAt));
      return rows.map(toOutreachSend);
    },

    async updateOutreachSend(id, patch) {
      const [row] = await q
        .update(outreachSends)
        .set({ ...patch, updatedAt: nowIso() })
        .where(eq(outreachSends.id, id))
        .returning();
      return row ? toOutreachSend(row) : null;
    },

    async createChannelAccount(input) {
      const { rows } = await db.pool.query<ChannelAccountRow>(
        `INSERT INTO channel_accounts (space_id, protocol, label, identifier, token, status)
         VALUES ($1, $2, $3, $4, $5, 'offline')
         RETURNING id, space_id, protocol, label, identifier, token, status, created_at::text, updated_at::text`,
        [input.spaceId, input.protocol, input.label, input.identifier ?? null, input.token ?? null],
      );
      return toChannelAccount(rows[0]!);
    },
    async listChannelAccounts(spaceId) {
      const { rows } = await db.pool.query<ChannelAccountRow>(
        `SELECT id, space_id, protocol, label, identifier, token, status, created_at::text, updated_at::text
         FROM channel_accounts WHERE space_id = $1 ORDER BY created_at ASC`,
        [spaceId],
      );
      return rows.map(toChannelAccount);
    },
    async listAllChannelAccounts() {
      const { rows } = await db.pool.query<ChannelAccountRow>(
        `SELECT id, space_id, protocol, label, identifier, token, status, created_at::text, updated_at::text
         FROM channel_accounts ORDER BY created_at ASC`,
      );
      return rows.map(toChannelAccount);
    },
    async getChannelAccount(id) {
      const { rows } = await db.pool.query<ChannelAccountRow>(
        `SELECT id, space_id, protocol, label, identifier, token, status, created_at::text, updated_at::text
         FROM channel_accounts WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? toChannelAccount(rows[0]) : null;
    },
    async updateChannelAccount(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (patch.status !== undefined) {
        params.push(patch.status);
        sets.push(`status = $${params.length}`);
      }
      if (patch.identifier !== undefined) {
        params.push(patch.identifier);
        sets.push(`identifier = $${params.length}`);
      }
      if (sets.length === 0) return this.getChannelAccount(id);
      params.push(id);
      const { rows } = await db.pool.query<ChannelAccountRow>(
        `UPDATE channel_accounts SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${params.length}
         RETURNING id, space_id, protocol, label, identifier, token, status, created_at::text, updated_at::text`,
        params,
      );
      return rows[0] ? toChannelAccount(rows[0]) : null;
    },
    async deleteChannelAccount(id) {
      await db.pool.query(`DELETE FROM channel_accounts WHERE id = $1`, [id]);
    },

    async listOrgNodes(organizationId) {
      const { rows } = await db.pool.query<OrgNodeRow>(
        `SELECT ${ORG_NODE_SELECT}
         FROM org_nodes WHERE organization_id = $1 ORDER BY created_at ASC`,
        [organizationId],
      );
      return rows.map(toOrgNode);
    },

    async getOrgNode(id) {
      const { rows } = await db.pool.query<OrgNodeRow>(
        `SELECT ${ORG_NODE_SELECT}
         FROM org_nodes WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? toOrgNode(rows[0]) : null;
    },

    async createOrgNode(input) {
      const { rows } = await db.pool.query<OrgNodeRow>(
        `INSERT INTO org_nodes (organization_id, space_id, kind, name, ref_id, config, position_x, position_y)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         RETURNING ${ORG_NODE_SELECT}`,
        [
          input.organizationId,
          input.spaceId ?? null,
          input.kind,
          input.name,
          input.refId ?? null,
          JSON.stringify(input.config ?? {}),
          input.position?.x ?? 0,
          input.position?.y ?? 0,
        ],
      );
      if (!rows[0]) throw new Error("failed to create org node");
      return toOrgNode(rows[0]);
    },

    async updateOrgNode(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (patch.name !== undefined) {
        params.push(patch.name);
        sets.push(`name = $${params.length}`);
      }
      if (patch.config !== undefined) {
        params.push(JSON.stringify(patch.config));
        sets.push(`config = $${params.length}::jsonb`);
      }
      if (patch.position !== undefined) {
        params.push(patch.position.x);
        sets.push(`position_x = $${params.length}`);
        params.push(patch.position.y);
        sets.push(`position_y = $${params.length}`);
      }
      if (sets.length === 0) return this.getOrgNode(id);
      params.push(id);
      const { rows } = await db.pool.query<OrgNodeRow>(
        `UPDATE org_nodes SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${params.length}
         RETURNING ${ORG_NODE_SELECT}`,
        params,
      );
      return rows[0] ? toOrgNode(rows[0]) : null;
    },

    async deleteOrgNode(id) {
      await db.pool.query(`DELETE FROM org_nodes WHERE id = $1`, [id]);
    },

    async listOrgEdges(organizationId) {
      const { rows } = await db.pool.query<OrgEdgeRow>(
        `SELECT ${ORG_EDGE_SELECT}
         FROM org_edges WHERE organization_id = $1 ORDER BY created_at ASC`,
        [organizationId],
      );
      return rows.map(toOrgEdge);
    },

    async createOrgEdge(input) {
      const endpoints = await db.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM org_nodes WHERE id = ANY($1::uuid[])`,
        [[input.fromNodeId, input.toNodeId]],
      );
      const count = Number(endpoints.rows[0]?.count ?? 0);
      if (count !== 2) {
        throw new Error("both edge endpoints must reference existing nodes");
      }
      const { rows } = await db.pool.query<OrgEdgeRow>(
        `INSERT INTO org_edges (organization_id, space_id, from_node_id, to_node_id, relation, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING ${ORG_EDGE_SELECT}`,
        [
          input.organizationId,
          input.spaceId ?? null,
          input.fromNodeId,
          input.toNodeId,
          input.relation,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      if (!rows[0]) throw new Error("failed to create org edge");
      return toOrgEdge(rows[0]);
    },

    async deleteOrgEdge(id) {
      await db.pool.query(`DELETE FROM org_edges WHERE id = $1`, [id]);
    },
  };

  return repo;
}
