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

/**
 * Persistence interface for the Jamot domain. This is the seam between the
 * Drizzle implementation and every service (routing, vault, api) that reads
 * or writes domain state. Implementations must be server-side validated for
 * ownership/tenant scoping by the caller, not the store.
 */

// --- Create inputs (server generates id + timestamps) ---

export type ChannelProtocol = "telegram" | "matrix";
export type ChannelAccountStatus = "offline" | "pairing" | "connecting" | "connected" | "error";

export interface ChannelAccountRecord {
  id: string;
  spaceId: string;
  protocol: ChannelProtocol;
  label: string;
  identifier: string | null;
  token: string | null;
  status: ChannelAccountStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Model providers (provider-agnostic, OpenAI-compatible endpoints) ---

export type ModelProviderStatus = "ok" | "error" | "unknown";

export interface ModelProviderRecord {
  id: string;
  ownerActorId: string | null;
  ownerOrganizationId: string | null;
  name: string;
  baseUrl: string;
  credentialRef: string;
  status: ModelProviderStatus;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewModelProvider {
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  name: string;
  baseUrl: string;
  credentialRef: string;
}

export interface ProviderModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  discovered: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewActor {
  type: Actor["type"];
  source?: Actor["source"];
  displayName: string;
  status?: Actor["status"];
  externalIdentities?: Actor["externalIdentities"];
  personalSpaceId?: string | null;
}

export interface NewPerson {
  actorId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  profile?: Person["profile"];
  membershipSpaceIds?: string[];
  reputation?: Record<string, number>;
}

/**
 * Channel identity that resolves to a Person. (provider, value) is globally
 * unique: upserting an existing identity never downgrades its confidence.
 */
export interface NewIdentity {
  actorId: string;
  personId?: string | null;
  provider: string;
  value: string;
  verified?: boolean;
  confidence?: number;
  source?: string;
}

export interface NewMergeCandidate {
  spaceId?: string | null;
  personAId: string;
  personBId: string;
  reason: string;
  detail?: Record<string, unknown>;
}

/** Server-side people query: search, filters and pagination. */
export interface PeopleFilter {
  spaceId?: string;
  /** Free-text search across name, email, phone and channel identifiers. */
  q?: string;
  /** Restrict to people carrying an identity of this provider. */
  channel?: string;
  sort?: "recently_active" | "recently_added" | "name";
  page?: number;
  perPage?: number;
}

/** Creates a Person for an external lead: actor + person, no user/credentials.
 * Leads appear in People but can never log in. */
export interface NewLeadPerson {
  displayName: string;
  email?: string | null;
  profile?: Person["profile"];
  membershipSpaceIds?: string[];
}

export interface NewLeadList {
  organizationId?: string | null;
  spaceId: string;
  createdBy?: string | null;
  name: string;
  description?: string;
  persona?: LeadList["persona"];
  area?: LeadList["area"];
  providerId: string;
  providerConfig?: Record<string, unknown>;
  status?: LeadList["status"];
  error?: string | null;
  leadCount?: number;
  lastRunAt?: string | null;
}

export interface NewLeadListMember {
  leadListId: string;
  personId: string;
  providerId: string;
  status?: LeadListMember["status"];
  raw?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
}

export interface NewAgent {
  actorId: string;
  ownerId: string;
  organizationIds?: string[];
  role?: string | null;
  purpose?: string | null;
  description?: string | null;
  harness: Agent["harness"];
  skillIds?: string[];
  capabilityIds?: string[];
  connectorIds?: string[];
  permissions?: string[];
  autonomy?: Agent["autonomy"];
  budget?: number | null;
  heartbeat?: Agent["heartbeat"];
  availability?: Agent["availability"];
  memoryScopes?: string[];
  subscribedEvents?: string[];
  schedules?: Agent["schedules"];
  actionPermissions?: Agent["actionPermissions"];
  systemPrompt?: string | null;
  model?: string | null;
  performance?: Record<string, number>;
}

export interface NewSpace {
  kind: Space["kind"];
  ownerActorId: string;
  name: string;
}

export interface NewOrganization {
  spaceId: string;
  slug?: string | null;
  logoUrl?: string | null;
  dream?: string;
  blueprint?: Record<string, unknown>;
  enabledAppIds?: string[];
  treasuryId?: string | null;
  reputation?: Record<string, number>;
}

export interface NewRole {
  actorId: string;
  spaceId: string;
  kind: Role["kind"];
  title?: string | null;
}

export interface NewTask {
  spaceId: string;
  projectId?: string | null;
  listId?: string | null;
  title: string;
  description?: string;
  status?: Task["status"];
  assigneeActorIds?: string[];
  targetType?: Task["targetType"];
  requiredCapabilityIds?: string[];
  outcome?: Record<string, unknown> | null;
  dueDate?: string | null;
  position?: number;
}

export interface NewTaskList {
  spaceId: string;
  name: string;
  position?: number;
}

export interface NewTaskAttachment {
  taskId: string;
  name: string;
  mimeType?: string;
  size?: number;
  data: string;
}

export interface NewSkill {
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  name: string;
  description?: string;
  body?: string;
  version?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  prerequisites?: string[];
  allowedCapabilityIds?: string[];
  evaluationCriteria?: string[];
  provenance: Skill["provenance"];
  status?: Skill["status"];
}

export interface NewConnector {
  provider: Connector["provider"];
  type?: Connector["type"];
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  sharing?: Connector["sharing"];
  capabilities?: string[];
  credentialRef: Connector["credentialRef"];
  scopes?: string[];
  configuration?: Record<string, unknown>;
  status?: Connector["status"];
}

export interface NewCapability {
  name: string;
  skillId: string;
  connectorId: string;
  policyIds?: string[];
  context?: Record<string, unknown>;
  spaceId: string;
}

export interface NewPolicy {
  spaceId: string;
  name: string;
  capability: string;
  resource?: string;
  minRole?: Policy["minRole"];
  riskThreshold?: number;
  decision: Policy["decision"];
}

export interface NewSupplier {
  actorId: string;
  organizationId?: string | null;
  onboardingStatus?: Supplier["onboardingStatus"];
  defaultCurrency?: string;
  terms?: string | null;
}

export interface NewProduct {
  spaceId?: string | null;
  gtin?: string | null;
  sku?: string | null;
  manufacturerId?: string | null;
  name: string;
  description?: string;
  dimensions?: Record<string, unknown> | null;
  packaging?: Record<string, unknown> | null;
  unitOfMeasure?: string;
  taxCategory?: string | null;
  compliance?: string[];
  lifecycle?: Product["lifecycle"];
}

export interface NewCatalog {
  ownerOrganizationId: string;
  name: string;
  version?: string;
  visibility?: Catalog["visibility"];
  source?: Catalog["source"];
  sourceOfTruth?: Catalog["sourceOfTruth"];
  syncRef?: string | null;
  lastSyncAt?: string | null;
  status?: Catalog["status"];
}

export interface NewCatalogOffer {
  catalogId: string;
  productId: string;
  sellerOrganizationId: string;
  spaceId?: string | null;
  orderableUnit?: string;
  priceQuantity?: number;
  priceTiers: CatalogOffer["priceTiers"];
  minQty?: number;
  maxQty?: number | null;
  orderIncrement?: number;
  availability?: string | null;
  leadTime?: string | null;
  validityFrom?: string | null;
  validityTo?: string | null;
  taxIncluded?: boolean;
  status?: CatalogOffer["status"];
}

export interface NewBuyerAgreement {
  catalogOfferId: string;
  buyerOrganizationId: string;
  priceTiers: BuyerAgreement["priceTiers"];
  validityFrom?: string | null;
  validityTo?: string | null;
}

export interface NewQuoteRequest {
  buyerOrganizationId: string;
  spaceId?: string | null;
  title: string;
  description?: string;
  items: QuoteRequest["items"];
  status?: QuoteRequest["status"];
  responseDeadline?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NewQuote {
  quoteRequestId: string;
  sellerOrganizationId: string;
  spaceId?: string | null;
  items: Quote["items"];
  total: number;
  currency?: string;
  terms?: string | null;
  status?: Quote["status"];
  transcript?: string[];
  validUntil?: string | null;
}

export interface NewPurchaseOrder {
  quoteId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  spaceId?: string | null;
  items: PurchaseOrder["items"];
  total: number;
  currency?: string;
  status?: PurchaseOrder["status"];
  approvedByActorId?: string | null;
}

export interface NewPaymentIntent {
  purchaseOrderId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  spaceId?: string | null;
  currency?: string;
  estimatedAmount: number;
  status?: PaymentIntent["status"];
  provider?: PaymentIntent["provider"];
  requiresApproval?: boolean;
  approvedByActorId?: string | null;
  providerReference?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NewPaymentRecord {
  paymentIntentId: string;
  spaceId?: string | null;
  paidAmount: number;
  currency?: string;
  providerReference?: string | null;
  settledAt?: string | null;
}

export interface NewOutreachList {
  spaceId: string;
  name: string;
  description?: string;
  memberPersonIds?: string[];
}

export interface NewOutreachCampaign {
  spaceId: string;
  name: string;
  description?: string;
  listId: string;
  agentId: string;
  goal: string;
  status?: OutreachCampaign["status"];
  startedAt?: string | null;
}

export interface NewOutreachStep {
  campaignId: string;
  position?: number;
  sendAfterDays?: number;
  channel?: OutreachStep["channel"];
  subject?: string;
  template?: string;
  instructions?: string;
}

export interface NewOutreachSend {
  campaignId: string;
  stepId: string;
  personId: string;
  status?: OutreachSend["status"];
  scheduledAt: string;
  taskId?: string | null;
  sentAt?: string | null;
  error?: string | null;
}

export interface SecretRecord {
  ref: string;
  scope: SecretRecordScope;
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  ciphertext: string;
}

export type SecretRecordScope =
  | "user"
  | "organization"
  | "system"
  | "environment";

/** Pending Composio OAuth handshake, persisted so the callback can be bound to
 * the acting session/scope and validated against the one-time `state` token. */
export interface ComposioOAuthStateRecord {
  state: string;
  actorId: string;
  organizationId?: string | null;
  sharing: Connector["sharing"];
  toolkit: string;
  composioUserId: string;
  apiKeyScope: SecretRecordScope;
  redirectUri: string;
  consumed: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// --- Update inputs (partial) ---

export type TaskStatusUpdate = Pick<Task, "status">;

// --- The repository ---

export interface JamotRepository {
  // model providers
  createModelProvider(input: NewModelProvider): Promise<ModelProviderRecord>;
  getModelProvider(id: string): Promise<ModelProviderRecord | null>;
  listModelProviders(filter?: {
    ownerActorId?: string;
    ownerOrganizationId?: string;
  }): Promise<ModelProviderRecord[]>;
  updateModelProvider(
    id: string,
    patch: Partial<
      Pick<
        ModelProviderRecord,
        "name" | "baseUrl" | "status" | "lastTestedAt" | "lastError"
      >
    >,
  ): Promise<ModelProviderRecord | null>;
  deleteModelProvider(id: string): Promise<void>;
  /** Upsert on (providerId, modelId); never flips an existing enabled flag. */
  upsertProviderModel(input: {
    providerId: string;
    modelId: string;
    discovered?: boolean;
  }): Promise<ProviderModelRecord>;
  listProviderModels(providerId: string): Promise<ProviderModelRecord[]>;
  updateProviderModel(
    id: string,
    patch: Partial<Pick<ProviderModelRecord, "enabled" | "discovered">>,
  ): Promise<ProviderModelRecord | null>;
  deleteProviderModel(id: string): Promise<void>;

  // actors
  createActor(input: NewActor): Promise<Actor>;
  getActor(id: string): Promise<Actor | null>;
  listActors(filter?: { spaceId?: string }): Promise<Actor[]>;
  updateActor(id: string, patch: Partial<Pick<Actor, "displayName" | "status" | "personalSpaceId">>): Promise<Actor | null>;
  findActorByExternalIdentity(provider: string, value: string): Promise<Actor | null>;
  findPersonByActorId(actorId: string): Promise<Person | null>;

  // identities — one Person, many channel identities
  /** Upsert on (provider, value). Never downgrades existing confidence. */
  addIdentity(input: NewIdentity): Promise<Identity>;
  listIdentitiesForActor(actorId: string): Promise<Identity[]>;
  listIdentitiesForPerson(personId: string): Promise<Identity[]>;
  /** Exact identity lookup — the entry point of identity resolution. */
  findActorByIdentity(provider: string, value: string): Promise<Actor | null>;
  findIdentity(provider: string, value: string): Promise<Identity | null>;
  updateIdentity(
    id: string,
    patch: Partial<Pick<Identity, "personId" | "verified" | "confidence" | "source">>,
  ): Promise<Identity | null>;
  removeIdentity(id: string): Promise<void>;

  // merge candidates — uncertain identity collisions, human-resolved
  createMergeCandidate(input: NewMergeCandidate): Promise<MergeCandidate>;
  listMergeCandidates(filter?: {
    spaceId?: string;
    status?: MergeCandidate["status"];
  }): Promise<MergeCandidate[]>;
  updateMergeCandidate(
    id: string,
    patch: Partial<Pick<MergeCandidate, "status" | "detail">>,
  ): Promise<MergeCandidate | null>;

  // people
  createPerson(input: NewPerson): Promise<Person>;
  getPerson(id: string): Promise<Person | null>;
  listPeople(filter?: { spaceId?: string }): Promise<Person[]>;
  /** Server-side search + pagination for large people databases. */
  searchPeople(filter: PeopleFilter): Promise<{ items: Person[]; total: number }>;
  updatePerson(
    id: string,
    patch: Partial<
      Pick<
        Person,
        | "profile"
        | "email"
        | "firstName"
        | "lastName"
        | "phone"
        | "avatarUrl"
        | "avatarSource"
        | "consent"
        | "lastInteractionAt"
        | "membershipSpaceIds"
        | "reputation"
      >
    >,
  ): Promise<Person | null>;
  findPersonByEmail(email: string): Promise<Person | null>;
  findPersonByPhone(phone: string): Promise<Person | null>;
  /** Delete a person row (identities/merge candidates cascade). */
  deletePerson(id: string): Promise<void>;
  /** Create an external lead as an actor + person (no user account). */
  createLeadPerson(input: NewLeadPerson): Promise<Person>;

  // lead generation & enrichment
  createLeadList(input: NewLeadList): Promise<LeadList>;
  getLeadList(id: string): Promise<LeadList | null>;
  listLeadLists(filter?: { spaceId?: string; organizationId?: string }): Promise<LeadList[]>;
  updateLeadList(
    id: string,
    patch: Partial<
      Pick<
        LeadList,
        | "name"
        | "description"
        | "persona"
        | "area"
        | "providerId"
        | "providerConfig"
        | "status"
        | "error"
        | "leadCount"
        | "lastRunAt"
      >
    >,
  ): Promise<LeadList | null>;
  deleteLeadList(id: string): Promise<void>;
  addLeadListMember(input: NewLeadListMember): Promise<LeadListMember>;
  updateLeadListMember(
    id: string,
    patch: Partial<Pick<LeadListMember, "status" | "raw">>,
  ): Promise<LeadListMember | null>;
  listLeadListMembers(leadListId: string): Promise<LeadListMember[]>;
  deleteLeadListMembers(leadListId: string): Promise<void>;

  // agents
  createAgent(input: NewAgent): Promise<Agent>;
  getAgent(id: string): Promise<Agent | null>;
  listAgents(filter?: { organizationId?: string }): Promise<Agent[]>;
  updateAgent(
    id: string,
    patch: Partial<
      Pick<
        Agent,
        | "role"
        | "purpose"
        | "description"
        | "organizationIds"
        | "skillIds"
        | "capabilityIds"
        | "connectorIds"
        | "permissions"
        | "autonomy"
        | "budget"
        | "heartbeat"
        | "availability"
        | "systemPrompt"
        | "memoryScopes"
        | "subscribedEvents"
        | "schedules"
        | "actionPermissions"
      >
    >,
  ): Promise<Agent | null>;
  deleteAgent(id: string): Promise<void>;

  // actor relationships
  createRelationship(input: {
    fromActorId: string;
    toActorId: string;
    kind: Relationship["kind"];
  }): Promise<Relationship>;
  listRelationshipsForActor(actorId: string): Promise<Relationship[]>;
  deleteRelationship(id: string): Promise<void>;

  // events / activity
  recordEvent(input: {
    type: string;
    spaceId?: string | null;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<Event>;
  listEvents(filter?: {
    actorId?: string;
    spaceId?: string;
    /** Only events strictly after this ISO timestamp. */
    since?: string;
    limit?: number;
  }): Promise<Event[]>;

  // spaces, organizations & workspaces
  createSpace(input: NewSpace): Promise<Space>;
  getSpace(id: string): Promise<Space | null>;
  getSpaceSettings(spaceId: string): Promise<Record<string, unknown>>;
  setSpaceSettings(
    spaceId: string,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  listSpaces(): Promise<Space[]>;
  updateSpace(id: string, patch: Partial<Pick<Space, "name">>): Promise<Space | null>;
  createOrganization(input: NewOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  listOrganizations(): Promise<Organization[]>;
  updateOrganization(
    id: string,
    patch: Partial<
      Pick<Organization, "dream" | "blueprint" | "enabledAppIds" | "slug" | "logoUrl">
    >,
  ): Promise<Organization | null>;
  createWorkspace(input: {
    organizationId: string;
    spaceId: string;
    name: string;
    config?: Record<string, unknown>;
  }): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(organizationId: string): Promise<Workspace[]>;
  getOrganizationBySpaceId(spaceId: string): Promise<Organization | null>;
  updateWorkspace(
    id: string,
    patch: Partial<Pick<Workspace, "name" | "config">>,
  ): Promise<Workspace | null>;
  deleteWorkspace(id: string): Promise<void>;
  /** Permanently delete an organization and all its data (workspaces, spaces,
   * roles, memberships, and every space-/org-scoped record). Runs in a transaction. */
  deleteOrganizationCascade(id: string): Promise<void>;

  // roles
  createRole(input: NewRole): Promise<Role>;
  listRolesForActor(actorId: string): Promise<Role[]>;
  listRolesForSpace(spaceId: string): Promise<Role[]>;
  updateRole(
    id: string,
    patch: Partial<Pick<Role, "kind" | "title">>,
  ): Promise<Role | null>;
  deleteRole(id: string): Promise<void>;

  // tasks
  createTask(input: NewTask): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  listTasks(filter?: { spaceId?: string; assigneeActorId?: string; listId?: string }): Promise<Task[]>;
  updateTaskStatus(id: string, status: Task["status"]): Promise<Task | null>;
  assignTask(id: string, assigneeActorIds: string[]): Promise<Task | null>;
  updateTask(
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "dueDate"
        | "listId"
        | "position"
        | "assigneeActorIds"
        | "targetType"
      >
    >,
  ): Promise<Task | null>;

  // task lists (Kanban columns)
  createTaskList(input: NewTaskList): Promise<TaskList>;
  getTaskList(id: string): Promise<TaskList | null>;
  listTaskLists(spaceId: string): Promise<TaskList[]>;
  updateTaskList(id: string, patch: Partial<Pick<TaskList, "name" | "position">>): Promise<TaskList | null>;
  deleteTaskList(id: string): Promise<void>;

  // task attachments
  addTaskAttachment(input: NewTaskAttachment): Promise<TaskAttachment>;
  listTaskAttachments(taskId: string): Promise<TaskAttachment[]>;
  deleteTaskAttachment(id: string): Promise<void>;

  // skills
  createSkill(input: NewSkill): Promise<Skill>;
  getSkill(id: string): Promise<Skill | null>;
  listSkills(filter?: { ownerOrganizationId?: string }): Promise<Skill[]>;
  updateSkill(
    id: string,
    patch: Partial<
      Pick<
        Skill,
        | "name"
        | "description"
        | "body"
        | "version"
        | "inputs"
        | "outputs"
        | "prerequisites"
        | "allowedCapabilityIds"
        | "evaluationCriteria"
        | "status"
      >
    >,
  ): Promise<Skill | null>;
  deleteSkill(id: string): Promise<void>;

  // connectors
  createConnector(input: NewConnector): Promise<Connector>;
  getConnector(id: string): Promise<Connector | null>;
  listConnectors(filter?: { ownerOrganizationId?: string }): Promise<Connector[]>;
  updateConnectorStatus(id: string, status: Connector["status"]): Promise<Connector | null>;
  updateConnector(
    id: string,
    patch: Partial<Pick<Connector, "status" | "configuration" | "sharing">>,
  ): Promise<Connector | null>;
  deleteConnector(id: string): Promise<void>;

  // composio oauth states
  putComposioOAuthState(
    input: Omit<ComposioOAuthStateRecord, "createdAt" | "updatedAt">,
  ): Promise<ComposioOAuthStateRecord>;
  getComposioOAuthState(state: string): Promise<ComposioOAuthStateRecord | null>;
  consumeComposioOAuthState(state: string): Promise<ComposioOAuthStateRecord | null>;

  // capabilities
  createCapability(input: NewCapability): Promise<Capability>;
  getCapability(id: string): Promise<Capability | null>;
  listCapabilities(filter?: { spaceId?: string }): Promise<Capability[]>;

  // policies
  createPolicy(input: NewPolicy): Promise<Policy>;
  listPolicies(filter?: { spaceId?: string }): Promise<Policy[]>;

  // secrets
  putSecret(secret: SecretRecord): Promise<void>;
  getSecret(ref: string): Promise<SecretRecord | null>;
  deleteSecret(ref: string): Promise<void>;

  // suppliers
  createSupplier(input: NewSupplier): Promise<Supplier>;
  getSupplier(id: string): Promise<Supplier | null>;
  getSupplierByActor(actorId: string): Promise<Supplier | null>;
  listSuppliers(filter?: { organizationId?: string }): Promise<Supplier[]>;
  updateSupplier(
    id: string,
    patch: Partial<
      Pick<Supplier, "onboardingStatus" | "defaultCurrency" | "terms" | "reputation"> & {
        organizationId?: string | null;
      }
    >,
  ): Promise<Supplier | null>;

  // products (master data)
  createProduct(input: NewProduct): Promise<Product>;
  getProduct(id: string): Promise<Product | null>;
  listProducts(filter?: { spaceId?: string }): Promise<Product[]>;

  // catalogs
  createCatalog(input: NewCatalog): Promise<Catalog>;
  getCatalog(id: string): Promise<Catalog | null>;
  listCatalogs(filter?: { ownerOrganizationId?: string }): Promise<Catalog[]>;
  updateCatalog(
    id: string,
    patch: Partial<
      Pick<Catalog, "name" | "version" | "visibility" | "source" | "sourceOfTruth" | "syncRef" | "lastSyncAt" | "status">
    >,
  ): Promise<Catalog | null>;

  // catalog offers
  createCatalogOffer(input: NewCatalogOffer): Promise<CatalogOffer>;
  getCatalogOffer(id: string): Promise<CatalogOffer | null>;
  listCatalogOffers(filter?: {
    catalogId?: string;
    sellerOrganizationId?: string;
    spaceId?: string;
  }): Promise<CatalogOffer[]>;
  updateCatalogOffer(
    id: string,
    patch: Partial<
      Pick<CatalogOffer, "priceTiers" | "minQty" | "maxQty" | "orderIncrement" | "availability" | "leadTime" | "validityFrom" | "validityTo" | "taxIncluded" | "status">
    >,
  ): Promise<CatalogOffer | null>;

  // buyer agreements
  createBuyerAgreement(input: NewBuyerAgreement): Promise<BuyerAgreement>;
  listBuyerAgreements(filter?: {
    catalogOfferId?: string;
    buyerOrganizationId?: string;
  }): Promise<BuyerAgreement[]>;

  // procurement: RFQ -> Quote -> Purchase Order
  createQuoteRequest(input: NewQuoteRequest): Promise<QuoteRequest>;
  getQuoteRequest(id: string): Promise<QuoteRequest | null>;
  listQuoteRequests(filter?: {
    buyerOrganizationId?: string;
    spaceId?: string;
  }): Promise<QuoteRequest[]>;
  updateQuoteRequestStatus(
    id: string,
    status: QuoteRequest["status"],
  ): Promise<QuoteRequest | null>;

  createQuote(input: NewQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | null>;
  listQuotes(filter?: { quoteRequestId?: string }): Promise<Quote[]>;
  updateQuoteStatus(id: string, status: Quote["status"]): Promise<Quote | null>;
  appendQuoteTranscript(id: string, message: string): Promise<Quote | null>;

  createPurchaseOrder(input: NewPurchaseOrder): Promise<PurchaseOrder>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | null>;
  listPurchaseOrders(filter?: {
    buyerOrganizationId?: string;
    sellerOrganizationId?: string;
    spaceId?: string;
  }): Promise<PurchaseOrder[]>;
  updatePurchaseOrder(
    id: string,
    patch: Partial<
      Pick<PurchaseOrder, "status" | "paymentIntentId"> & {
        approvedByActorId?: string | null;
        paymentIntentId?: string | null;
      }
    >,
  ): Promise<PurchaseOrder | null>;

  // payments
  createPaymentIntent(input: NewPaymentIntent): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent | null>;
  listPaymentIntents(filter?: {
    buyerOrganizationId?: string;
    sellerOrganizationId?: string;
    purchaseOrderId?: string;
    spaceId?: string;
  }): Promise<PaymentIntent[]>;
  updatePaymentIntent(
    id: string,
    patch: Partial<
      Pick<
        PaymentIntent,
        | "status"
        | "providerReference"
        | "provider"
        | "metadata"
      > & {
        approvedByActorId?: string | null;
      }
    >,
  ): Promise<PaymentIntent | null>;

  createPaymentRecord(input: NewPaymentRecord): Promise<PaymentRecord>;
  listPaymentRecords(paymentIntentId: string): Promise<PaymentRecord[]>;

  // outreach
  createOutreachList(input: NewOutreachList): Promise<OutreachList>;
  getOutreachList(id: string): Promise<OutreachList | null>;
  listOutreachLists(spaceId: string): Promise<OutreachList[]>;
  updateOutreachList(
    id: string,
    patch: Partial<
      Pick<OutreachList, "name" | "description" | "memberPersonIds">
    >,
  ): Promise<OutreachList | null>;
  deleteOutreachList(id: string): Promise<void>;

  createOutreachCampaign(input: NewOutreachCampaign): Promise<OutreachCampaign>;
  getOutreachCampaign(id: string): Promise<OutreachCampaign | null>;
  listOutreachCampaigns(filter?: {
    spaceId?: string;
    status?: OutreachCampaign["status"];
  }): Promise<OutreachCampaign[]>;
  updateOutreachCampaign(
    id: string,
    patch: Partial<
      Pick<
        OutreachCampaign,
        | "name"
        | "description"
        | "listId"
        | "agentId"
        | "goal"
        | "status"
        | "startedAt"
      >
    >,
  ): Promise<OutreachCampaign | null>;
  deleteOutreachCampaign(id: string): Promise<void>;

  createOutreachStep(input: NewOutreachStep): Promise<OutreachStep>;
  listOutreachSteps(campaignId: string): Promise<OutreachStep[]>;
  updateOutreachStep(
    id: string,
    patch: Partial<
      Pick<
        OutreachStep,
        | "position"
        | "sendAfterDays"
        | "channel"
        | "subject"
        | "template"
        | "instructions"
      >
    >,
  ): Promise<OutreachStep | null>;
  deleteOutreachStep(id: string): Promise<void>;

  createOutreachSend(input: NewOutreachSend): Promise<OutreachSend>;
  getOutreachSend(id: string): Promise<OutreachSend | null>;
  findOutreachSend(
    campaignId: string,
    stepId: string,
    personId: string,
  ): Promise<OutreachSend | null>;
  listOutreachSends(filter?: {
    campaignId?: string;
    personId?: string;
  }): Promise<OutreachSend[]>;
  updateOutreachSend(
    id: string,
    patch: Partial<
      Pick<OutreachSend, "status" | "taskId" | "sentAt" | "error">
    >,
  ): Promise<OutreachSend | null>;

  createChannelAccount(input: {
    spaceId: string;
    protocol: ChannelProtocol;
    label: string;
    identifier?: string | null;
    token?: string | null;
  }): Promise<ChannelAccountRecord>;
  listChannelAccounts(spaceId: string): Promise<ChannelAccountRecord[]>;
  listAllChannelAccounts(): Promise<ChannelAccountRecord[]>;
  getChannelAccount(id: string): Promise<ChannelAccountRecord | null>;
  updateChannelAccount(
    id: string,
    patch: {
      status?: ChannelAccountStatus;
      identifier?: string | null;
    },
  ): Promise<ChannelAccountRecord | null>;
  deleteChannelAccount(id: string): Promise<void>;

  // org graph (Vibe DREAM)
  listOrgNodes(organizationId: string): Promise<OrgNode[]>;
  getOrgNode(id: string): Promise<OrgNode | null>;
  createOrgNode(input: {
    organizationId: string;
    spaceId?: string | null;
    kind: OrgNode["kind"];
    name: string;
    refId?: string | null;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
  }): Promise<OrgNode>;
  updateOrgNode(
    id: string,
    patch: Partial<{
      name: string;
      config: Record<string, unknown>;
      position: { x: number; y: number };
    }>,
  ): Promise<OrgNode | null>;
  deleteOrgNode(id: string): Promise<void>;
  listOrgEdges(organizationId: string): Promise<OrgEdge[]>;
  createOrgEdge(input: {
    organizationId: string;
    spaceId?: string | null;
    fromNodeId: string;
    toNodeId: string;
    relation: OrgEdge["relation"];
    metadata?: Record<string, unknown>;
  }): Promise<OrgEdge>;
  deleteOrgEdge(id: string): Promise<void>;
}
