import { randomUUID } from "node:crypto";
import {
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

const now = () => new Date().toISOString();
const uuid = () => randomUUID();

export function createMemoryRepository(): JamotRepository {
  const actors = new Map<string, Actor>();
  const people = new Map<string, Person>();
  const agents = new Map<string, Agent>();
  const spaces = new Map<string, Space>();
  const spaceSettingsStore = new Map<string, Record<string, unknown>>();
  const organizations = new Map<string, Organization>();
  const workspaces = new Map<string, Workspace>();
  const roles = new Map<string, Role>();
  const tasks = new Map<string, Task>();
  const taskLists = new Map<string, TaskList>();
  const taskAttachments = new Map<string, TaskAttachment>();
  const skills = new Map<string, Skill>();
  const connectors = new Map<string, Connector>();
  const composioOAuthStates = new Map<string, ComposioOAuthStateRecord>();
  const capabilities = new Map<string, Capability>();
  const policies = new Map<string, Policy>();
  const relationships = new Map<string, Relationship>();
  const events: Event[] = [];
  const secrets = new Map<string, SecretRecord>();
  const supplierStore = new Map<string, Supplier>();
  const productStore = new Map<string, Product>();
  const catalogStore = new Map<string, Catalog>();
  const catalogOfferStore = new Map<string, CatalogOffer>();
  const buyerAgreementStore = new Map<string, BuyerAgreement>();
  const quoteRequestStore = new Map<string, QuoteRequest>();
  const quoteStore = new Map<string, Quote>();
  const purchaseOrderStore = new Map<string, PurchaseOrder>();
  const paymentIntentStore = new Map<string, PaymentIntent>();
  const paymentRecordStore = new Map<string, PaymentRecord>();
  const leadListStore = new Map<string, LeadList>();
  const leadListMemberStore = new Map<string, LeadListMember>();
  const outreachLists = new Map<string, OutreachList>();
  const outreachCampaigns = new Map<string, OutreachCampaign>();
  const outreachSteps = new Map<string, OutreachStep>();
  const outreachSends = new Map<string, OutreachSend>();
  const channelAccounts = new Map<string, ChannelAccountRecord>();
  const identityStore = new Map<string, Identity>();
  const mergeCandidateStore = new Map<string, MergeCandidate>();
  const modelProviderStore = new Map<string, ModelProviderRecord>();
  const providerModelStore = new Map<string, ProviderModelRecord>();
  const orgNodes = new Map<string, OrgNode>();
  const orgEdges = new Map<string, OrgEdge>();

  const repo: JamotRepository = {
    async createModelProvider(input: NewModelProvider) {
      const record: ModelProviderRecord = {
        id: uuid(),
        ownerActorId: input.ownerActorId ?? null,
        ownerOrganizationId: input.ownerOrganizationId ?? null,
        name: input.name,
        baseUrl: input.baseUrl,
        credentialRef: input.credentialRef,
        status: "unknown",
        lastTestedAt: null,
        lastError: null,
        createdAt: now(),
        updatedAt: now(),
      };
      modelProviderStore.set(record.id, record);
      return record;
    },

    async getModelProvider(id) {
      return modelProviderStore.get(id) ?? null;
    },

    async listModelProviders(filter) {
      return [...modelProviderStore.values()]
        .filter((p) => {
          if (filter?.ownerActorId && p.ownerActorId !== filter.ownerActorId) return false;
          if (
            filter?.ownerOrganizationId &&
            p.ownerOrganizationId !== filter.ownerOrganizationId
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async updateModelProvider(id, patch) {
      const existing = modelProviderStore.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updatedAt: now() };
      modelProviderStore.set(id, updated);
      return updated;
    },

    async deleteModelProvider(id) {
      modelProviderStore.delete(id);
      for (const [modelRowId, modelRow] of providerModelStore.entries()) {
        if (modelRow.providerId === id) providerModelStore.delete(modelRowId);
      }
    },

    async upsertProviderModel(input) {
      const discovered = input.discovered ?? true;
      for (const existing of providerModelStore.values()) {
        if (existing.providerId === input.providerId && existing.modelId === input.modelId) {
          if (!existing.discovered && discovered) {
            const updated = { ...existing, discovered: true, updatedAt: now() };
            providerModelStore.set(existing.id, updated);
            return updated;
          }
          return existing;
        }
      }
      const record: ProviderModelRecord = {
        id: uuid(),
        providerId: input.providerId,
        modelId: input.modelId,
        discovered,
        enabled: true,
        createdAt: now(),
        updatedAt: now(),
      };
      providerModelStore.set(record.id, record);
      return record;
    },

    async listProviderModels(providerId) {
      return [...providerModelStore.values()]
        .filter((m) => m.providerId === providerId)
        .sort((a, b) => a.modelId.localeCompare(b.modelId));
    },

    async updateProviderModel(id, patch) {
      const existing = providerModelStore.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updatedAt: now() };
      providerModelStore.set(id, updated);
      return updated;
    },

    async deleteProviderModel(id) {
      providerModelStore.delete(id);
    },

    async createActor(input: NewActor) {
      const actor = Actor.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        type: input.type,
        source: input.source ?? "internal",
        displayName: input.displayName,
        status: input.status ?? "active",
        externalIdentities: input.externalIdentities ?? [],
        personalSpaceId: input.personalSpaceId ?? null,
      });
      actors.set(actor.id, actor);
      return actor;
    },

    async getActor(id) {
      return actors.get(id) ?? null;
    },

    async listActors(filter) {
      const all = [...actors.values()];
      if (!filter?.spaceId) return all;
      const spaceId = filter.spaceId;
      const memberIds = new Set(
        [...roles.values()].filter((r) => r.spaceId === spaceId).map((r) => r.actorId),
      );
      return all.filter((a) => a.personalSpaceId === spaceId || memberIds.has(a.id));
    },

    async updateActor(id, patch) {
      const existing = actors.get(id);
      if (!existing) return null;
      const updated = Actor.parse({ ...existing, ...patch, updatedAt: now() });
      actors.set(id, updated);
      return updated;
    },

    async findActorByExternalIdentity(provider, value) {
      for (const actor of actors.values()) {
        const found = (actor.externalIdentities ?? []).find(
          (id) => id.provider === provider && id.value === value,
        );
        if (found) return actor;
      }
      return null;
    },

    async findPersonByActorId(actorId) {
      for (const person of people.values()) {
        if (person.actorId === actorId) return person;
      }
      return null;
    },

    async addIdentity(input: NewIdentity) {
      const confidence = input.confidence ?? 1;
      const existing = await repo.findIdentity(input.provider, input.value);
      if (existing) {
        const updated = Identity.parse({ ...existing });
        if (input.personId && !updated.personId) updated.personId = input.personId as Id;
        if (input.verified && !updated.verified) updated.verified = true;
        if (confidence > updated.confidence) {
          updated.confidence = confidence;
          if (input.source) updated.source = input.source;
        }
        updated.updatedAt = now();
        identityStore.set(existing.id, updated);
        return updated;
      }
      const identity = Identity.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        actorId: input.actorId,
        personId: input.personId ?? null,
        provider: input.provider,
        value: input.value,
        verified: input.verified ?? true,
        confidence,
        source: input.source ?? "observed",
      });
      identityStore.set(identity.id, identity);
      return identity;
    },

    async listIdentitiesForActor(actorId) {
      return [...identityStore.values()]
        .filter((i) => i.actorId === actorId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async listIdentitiesForPerson(personId) {
      return [...identityStore.values()]
        .filter((i) => i.personId === personId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async findActorByIdentity(provider, value) {
      const identity = await repo.findIdentity(provider, value);
      if (identity) return repo.getActor(identity.actorId);
      return repo.findActorByExternalIdentity(provider, value);
    },

    async findIdentity(provider, value) {
      for (const identity of identityStore.values()) {
        if (identity.provider === provider && identity.value === value) {
          return identity;
        }
      }
      return null;
    },

    async updateIdentity(id, patch) {
      const existing = identityStore.get(id);
      if (!existing) return null;
      const updated = Identity.parse({ ...existing, ...patch, updatedAt: now() });
      identityStore.set(id, updated);
      return updated;
    },

    async removeIdentity(id) {
      identityStore.delete(id);
    },

    async createMergeCandidate(input: NewMergeCandidate) {
      const candidate = MergeCandidate.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        spaceId: input.spaceId ?? null,
        personAId: input.personAId,
        personBId: input.personBId,
        reason: input.reason,
        detail: input.detail ?? {},
        status: "pending",
      });
      mergeCandidateStore.set(candidate.id, candidate);
      return candidate;
    },

    async listMergeCandidates(filter) {
      return [...mergeCandidateStore.values()].filter((c) => {
        if (filter?.status && c.status !== filter.status) return false;
        if (filter?.spaceId && c.spaceId !== filter.spaceId) return false;
        return true;
      });
    },

    async updateMergeCandidate(id, patch) {
      const existing = mergeCandidateStore.get(id);
      if (!existing) return null;
      const updated = MergeCandidate.parse({ ...existing, ...patch, updatedAt: now() });
      mergeCandidateStore.set(id, updated);
      return updated;
    },

    async createPerson(input: NewPerson) {
      const person = Person.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        actorId: input.actorId,
        email: input.email ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        avatarUrl: input.avatarUrl ?? null,
        avatarSource: input.avatarSource ?? null,
        profile: input.profile ?? {},
        membershipSpaceIds: input.membershipSpaceIds ?? [],
        reputation: input.reputation ?? {},
      });
      people.set(person.id, person);
      return person;
    },

    async getPerson(id) {
      return people.get(id) ?? null;
    },

    async listPeople(filter) {
      if (!filter?.spaceId) return [...people.values()];
      return [...people.values()].filter((p) =>
        (p.membershipSpaceIds ?? []).includes(filter.spaceId as Id),
      );
    },

    async searchPeople(filter: PeopleFilter) {
      const page = Math.max(1, filter.page ?? 1);
      const perPage = Math.min(200, Math.max(1, filter.perPage ?? 50));
      const q = filter.q?.trim().toLowerCase();

      let matches = [...people.values()].filter((p) => {
        if (filter.spaceId && !(p.membershipSpaceIds ?? []).includes(filter.spaceId as Id)) {
          return false;
        }
        if (filter.channel) {
          const hasChannel = [...identityStore.values()].some(
            (i) => i.personId === p.id && i.provider === filter.channel,
          );
          if (!hasChannel) return false;
        }
        if (q) {
          const haystack = [p.firstName, p.lastName, p.email, p.phone]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

      matches = matches.sort((a, b) => {
        if (filter.sort === "name") {
          return `${a.firstName ?? ""} ${a.lastName ?? ""}`.localeCompare(
            `${b.firstName ?? ""} ${b.lastName ?? ""}`,
          );
        }
        if (filter.sort === "recently_added") {
          return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        }
        return (b.lastInteractionAt ?? b.createdAt ?? "").localeCompare(
          a.lastInteractionAt ?? a.createdAt ?? "",
        );
      });

      const total = matches.length;
      const items = matches.slice((page - 1) * perPage, page * perPage);
      return { items, total };
    },

    async updatePerson(id, patch) {
      const existing = people.get(id);
      if (!existing) return null;
      const updated = Person.parse({ ...existing, ...patch, updatedAt: now() });
      people.set(id, updated);
      return updated;
    },

    async findPersonByEmail(email) {
      const lower = email.toLowerCase();
      for (const person of people.values()) {
        if (person.email?.toLowerCase() === lower) return person;
      }
      return null;
    },

    async findPersonByPhone(phone) {
      for (const person of people.values()) {
        if (person.phone === phone) return person;
      }
      return null;
    },

    async deletePerson(id) {
      people.delete(id);
      for (const [identityId, identity] of identityStore.entries()) {
        if (identity.personId === id) identityStore.delete(identityId);
      }
      for (const [candidateId, candidate] of mergeCandidateStore.entries()) {
        if (candidate.personAId === id || candidate.personBId === id) {
          mergeCandidateStore.delete(candidateId);
        }
      }
    },

    async createLeadPerson(input: NewLeadPerson) {
      const actor = await this.createActor({
        type: "human",
        source: "external",
        displayName: input.displayName,
      });
      const person = Person.parse({
        id: uuid(),
        actorId: actor.id,
        email: input.email ?? null,
        profile: input.profile ?? {},
        membershipSpaceIds: input.membershipSpaceIds ?? [],
        reputation: {},
      });
      people.set(person.id, person);
      return person;
    },

    async createLeadList(input: NewLeadList) {
      const list = LeadList.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        organizationId: input.organizationId ?? null,
        spaceId: input.spaceId,
        createdBy: input.createdBy ?? null,
        name: input.name,
        description: input.description ?? "",
        persona: input.persona ?? {},
        area: input.area ?? null,
        providerId: input.providerId,
        providerConfig: input.providerConfig ?? {},
        status: input.status ?? "draft",
        error: input.error ?? null,
        leadCount: input.leadCount ?? 0,
        lastRunAt: input.lastRunAt ?? null,
      });
      leadListStore.set(list.id, list);
      return list;
    },

    async getLeadList(id) {
      return leadListStore.get(id) ?? null;
    },

    async listLeadLists(filter) {
      let all = [...leadListStore.values()];
      if (filter?.spaceId) all = all.filter((l) => l.spaceId === filter.spaceId);
      if (filter?.organizationId) {
        all = all.filter((l) => l.organizationId === filter.organizationId);
      }
      return all;
    },

    async updateLeadList(id, patch) {
      const existing = leadListStore.get(id);
      if (!existing) return null;
      const updated = LeadList.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      leadListStore.set(id, updated);
      return updated;
    },

    async deleteLeadList(id) {
      leadListStore.delete(id);
    },

    async addLeadListMember(input: NewLeadListMember) {
      const member = LeadListMember.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        leadListId: input.leadListId,
        personId: input.personId,
        providerId: input.providerId,
        status: input.status ?? "new",
        raw: input.raw ?? {},
        provenance: input.provenance ?? {},
      });
      leadListMemberStore.set(member.id, member);
      return member;
    },

    async updateLeadListMember(id, patch) {
      const existing = leadListMemberStore.get(id);
      if (!existing) return null;
      const updated = LeadListMember.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      leadListMemberStore.set(id, updated);
      return updated;
    },

    async listLeadListMembers(leadListId) {
      return [...leadListMemberStore.values()].filter(
        (m) => m.leadListId === leadListId,
      );
    },

    async deleteLeadListMembers(leadListId) {
      for (const [id, member] of leadListMemberStore) {
        if (member.leadListId === leadListId) leadListMemberStore.delete(id);
      }
    },

    async createAgent(input: NewAgent) {
      const agent = Agent.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
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
        budget: input.budget ?? null,
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
      });
      agents.set(agent.id, agent);
      return agent;
    },

    async getAgent(id) {
      return agents.get(id) ?? null;
    },

    async listAgents(filter) {
      const all = [...agents.values()];
      if (!filter?.organizationId) return all;
      return all.filter((a) =>
        a.organizationIds.includes(filter.organizationId as Id),
      );
    },

    async updateAgent(id, patch) {
      const existing = agents.get(id);
      if (!existing) return null;
      const updated = Agent.parse({ ...existing, ...patch });
      agents.set(id, updated);
      return updated;
    },

    async deleteAgent(id) {
      agents.delete(id);
    },

    async createRelationship(input) {
      const relationship = Relationship.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        fromActorId: input.fromActorId,
        toActorId: input.toActorId,
        kind: input.kind,
      });
      relationships.set(relationship.id, relationship);
      return relationship;
    },

    async listRelationshipsForActor(actorId) {
      return [...relationships.values()].filter(
        (r) => r.fromActorId === actorId || r.toActorId === actorId,
      );
    },

    async deleteRelationship(id) {
      relationships.delete(id);
    },

    async recordEvent(input) {
      const event = Event.parse({
        id: uuid(),
        type: input.type,
        spaceId: input.spaceId ?? null,
        actorId: input.actorId ?? null,
        idempotencyKey: uuid(),
        payload: input.payload ?? {},
        occurredAt: now(),
        delivered: false,
      });
      events.push(event);
      return event;
    },

    async listEvents(filter) {
      let all = [...events];
      if (filter?.actorId) all = all.filter((e) => e.actorId === filter.actorId);
      if (filter?.spaceId) all = all.filter((e) => e.spaceId === filter.spaceId);
      if (filter?.since) {
        all = all.filter((e) => e.occurredAt.localeCompare(filter.since as string) > 0);
      }
      return all
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, filter?.limit ?? 50);
    },

    async createSpace(input: NewSpace) {
      const space = Space.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        kind: input.kind,
        ownerActorId: input.ownerActorId,
        name: input.name,
      });
      spaces.set(space.id, space);
      return space;
    },

    async getSpace(id) {
      return spaces.get(id) ?? null;
    },

    async getSpaceSettings(spaceId: string): Promise<Record<string, unknown>> {
      return spaceSettingsStore.get(spaceId) ?? {};
    },

    async setSpaceSettings(
      spaceId: string,
      patch: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
      const next = { ...this.getSpaceSettings(spaceId), ...patch };
      spaceSettingsStore.set(spaceId, next);
      return next;
    },

    async listSpaces() {
      return [...spaces.values()];
    },

    async updateSpace(id, patch) {
      const existing = spaces.get(id);
      if (!existing) return null;
      const updated = Space.parse({ ...existing, ...patch, updatedAt: now() });
      spaces.set(id, updated);
      return updated;
    },

    async createOrganization(input: NewOrganization) {
      const organization = Organization.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        spaceId: input.spaceId,
        slug: input.slug ?? null,
        logoUrl: input.logoUrl ?? null,
        dream: input.dream ?? "",
        blueprint: input.blueprint ?? {},
        enabledAppIds: input.enabledAppIds ?? [],
        treasuryId: input.treasuryId ?? null,
        reputation: input.reputation ?? {},
      });
      organizations.set(organization.id, organization);
      return organization;
    },

    async getOrganization(id) {
      return organizations.get(id) ?? null;
    },

    async getOrganizationBySlug(slug) {
      for (const organization of organizations.values()) {
        if (organization.slug === slug) return organization;
      }
      return null;
    },

    async listOrganizations() {
      return [...organizations.values()];
    },

    async updateOrganization(id, patch) {
      const existing = organizations.get(id);
      if (!existing) return null;
      const updated = Organization.parse({ ...existing, ...patch, updatedAt: now() });
      organizations.set(id, updated);
      return updated;
    },

    async createWorkspace(input) {
      const workspace = Workspace.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        organizationId: input.organizationId,
        spaceId: input.spaceId,
        name: input.name,
        config: input.config ?? {},
      });
      workspaces.set(workspace.id, workspace);
      return workspace;
    },

    async getWorkspace(id) {
      return workspaces.get(id) ?? null;
    },

    async listWorkspaces(organizationId) {
      return [...workspaces.values()].filter(
        (w) => w.organizationId === organizationId,
      );
    },

    async getOrganizationBySpaceId(spaceId) {
      const ws = [...workspaces.values()].find((w) => w.spaceId === spaceId);
      if (!ws) return null;
      return this.getOrganization(ws.organizationId);
    },

    async updateWorkspace(id, patch) {
      const existing = workspaces.get(id);
      if (!existing) return null;
      const updated = Workspace.parse({ ...existing, ...patch, updatedAt: now() });
      workspaces.set(id, updated);
      return updated;
    },

    async deleteWorkspace(id) {
      workspaces.delete(id);
    },

    async deleteOrganizationCascade(id) {
      const org = organizations.get(id);
      if (!org) return;
      const spaceIds = new Set<Id>([org.spaceId]);
      for (const ws of workspaces.values()) {
        if (ws.organizationId === id) spaceIds.add(ws.spaceId);
      }
      for (const spaceId of spaceIds) {
        for (const [roleId, role] of roles) {
          if (role.spaceId === spaceId) roles.delete(roleId);
        }
        for (const [taskId, task] of tasks) {
          if (task.spaceId === spaceId) tasks.delete(taskId);
        }
        for (const [listId, list] of taskLists) {
          if (list.spaceId === spaceId) taskLists.delete(listId);
        }
        for (const [capId, cap] of capabilities) {
          if (cap.spaceId === spaceId) capabilities.delete(capId);
        }
        for (const [polId, pol] of policies) {
          if (pol.spaceId === spaceId) policies.delete(polId);
        }
        for (const [prodId, prod] of productStore) {
          if (prod.spaceId === spaceId) productStore.delete(prodId);
        }
        for (const [offerId, offer] of catalogOfferStore) {
          if (offer.spaceId === spaceId) catalogOfferStore.delete(offerId);
        }
        for (const [qrId, qr] of quoteRequestStore) {
          if (qr.spaceId === spaceId) quoteRequestStore.delete(qrId);
        }
        for (const [quoteId, quote] of quoteStore) {
          if (quote.spaceId === spaceId) quoteStore.delete(quoteId);
        }
        for (const [poId, po] of purchaseOrderStore) {
          if (po.spaceId === spaceId) purchaseOrderStore.delete(poId);
        }
        for (const [piId, pi] of paymentIntentStore) {
          if (pi.spaceId === spaceId) paymentIntentStore.delete(piId);
        }
        for (const [prId, pr] of paymentRecordStore) {
          if (pr.spaceId === spaceId) paymentRecordStore.delete(prId);
        }
        for (const [attId, att] of taskAttachments) {
          const task = [...tasks.values()].find((t) => t.id === att.taskId);
          if (!task || task.spaceId === spaceId) taskAttachments.delete(attId);
        }
        for (const person of people.values()) {
          if ((person.membershipSpaceIds ?? []).includes(spaceId)) {
            person.membershipSpaceIds = (person.membershipSpaceIds ?? []).filter(
              (sid) => sid !== spaceId,
            );
          }
        }
        spaces.delete(spaceId);
      }
      for (const [skillId, skill] of skills) {
        if (skill.ownerOrganizationId === id) skills.delete(skillId);
      }
      for (const [connId, conn] of connectors) {
        if (conn.ownerOrganizationId === id) connectors.delete(connId);
      }
      for (const [secId, sec] of secrets) {
        if (sec.ownerOrganizationId === id) secrets.delete(secId);
      }
      for (const [supId, sup] of supplierStore) {
        if (sup.organizationId === id) supplierStore.delete(supId);
      }
      for (const [catId, cat] of catalogStore) {
        if (cat.ownerOrganizationId === id) catalogStore.delete(catId);
      }
      for (const [agId, ag] of buyerAgreementStore) {
        if (ag.buyerOrganizationId === id) buyerAgreementStore.delete(agId);
      }
      for (const [agentId, agent] of agents) {
        agent.organizationIds = (agent.organizationIds ?? []).filter(
          (orgId) => orgId !== id,
        );
        if (agent.organizationIds.length === 0) agents.delete(agentId);
      }
      for (const ws of [...workspaces.values()]) {
        if (ws.organizationId === id) workspaces.delete(ws.id);
      }
      organizations.delete(id);
    },

    async createRole(input: NewRole) {
      const role = Role.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        actorId: input.actorId,
        spaceId: input.spaceId,
        kind: input.kind,
        title: input.title ?? null,
      });
      roles.set(role.id, role);
      return role;
    },

    async listRolesForActor(actorId) {
      return [...roles.values()].filter((r) => r.actorId === actorId);
    },

    async listRolesForSpace(spaceId) {
      return [...roles.values()].filter((r) => r.spaceId === spaceId);
    },

    async updateRole(id, patch) {
      const existing = roles.get(id);
      if (!existing) return null;
      const updated = Role.parse({ ...existing, ...patch, updatedAt: now() });
      roles.set(id, updated);
      return updated;
    },

    async deleteRole(id) {
      roles.delete(id);
    },

    async createTask(input: NewTask) {
      const task = Task.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
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
      });
      tasks.set(task.id, task);
      return task;
    },

    async getTask(id) {
      return tasks.get(id) ?? null;
    },

    async listTasks(filter) {
      let all = [...tasks.values()];
      if (filter?.spaceId) all = all.filter((t) => t.spaceId === filter.spaceId);
      if (filter?.listId) all = all.filter((t) => t.listId === filter.listId);
      if (filter?.assigneeActorId) {
        all = all.filter((t) =>
          t.assigneeActorIds.includes(filter.assigneeActorId as Id),
        );
      }
      return all;
    },

    async updateTaskStatus(id, status) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const updated = Task.parse({ ...existing, status, updatedAt: now() });
      tasks.set(id, updated);
      return updated;
    },

    async assignTask(id, assigneeActorIds) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const updated = Task.parse({ ...existing, assigneeActorIds, updatedAt: now() });
      tasks.set(id, updated);
      return updated;
    },

    async updateTask(id, patch) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const updated = Task.parse({ ...existing, ...patch, updatedAt: now() });
      tasks.set(id, updated);
      return updated;
    },

    async createTaskList(input: NewTaskList) {
      const list = TaskList.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        spaceId: input.spaceId,
        name: input.name,
        position: input.position ?? 0,
      });
      taskLists.set(list.id, list);
      return list;
    },

    async getTaskList(id) {
      return taskLists.get(id) ?? null;
    },

    async listTaskLists(spaceId) {
      return [...taskLists.values()]
        .filter((list) => list.spaceId === spaceId)
        .sort((a, b) => a.position - b.position);
    },

    async updateTaskList(id, patch) {
      const existing = taskLists.get(id);
      if (!existing) return null;
      const updated = TaskList.parse({ ...existing, ...patch, updatedAt: now() });
      taskLists.set(id, updated);
      return updated;
    },

    async deleteTaskList(id) {
      taskLists.delete(id);
    },

    async addTaskAttachment(input: NewTaskAttachment) {
      const attachment = TaskAttachment.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        taskId: input.taskId,
        name: input.name,
        mimeType: input.mimeType ?? "application/octet-stream",
        size: input.size ?? 0,
        data: input.data,
      });
      taskAttachments.set(attachment.id, attachment);
      return attachment;
    },

    async listTaskAttachments(taskId) {
      return [...taskAttachments.values()].filter((a) => a.taskId === taskId);
    },

    async deleteTaskAttachment(id) {
      taskAttachments.delete(id);
    },

    async createSkill(input: NewSkill) {
      const skill = Skill.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
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
      });
      skills.set(skill.id, skill);
      return skill;
    },

    async getSkill(id) {
      return skills.get(id) ?? null;
    },

    async listSkills(filter) {
      const all = [...skills.values()];
      if (!filter?.ownerOrganizationId) return all;
      return all.filter((s) => s.ownerOrganizationId === filter.ownerOrganizationId);
    },

    async updateSkill(id, patch) {
      const existing = skills.get(id);
      if (!existing) return null;
      const updated = Skill.parse({ ...existing, ...patch, updatedAt: now() });
      skills.set(id, updated);
      return updated;
    },

    async deleteSkill(id) {
      skills.delete(id);
    },

    async createConnector(input: NewConnector) {
      const connector = Connector.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
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
      });
      connectors.set(connector.id, connector);
      return connector;
    },

    async getConnector(id) {
      return connectors.get(id) ?? null;
    },

    async listConnectors(filter) {
      const all = [...connectors.values()];
      if (!filter?.ownerOrganizationId) return all;
      return all.filter((c) => c.ownerOrganizationId === filter.ownerOrganizationId);
    },

    async updateConnectorStatus(id, status) {
      const existing = connectors.get(id);
      if (!existing) return null;
      const updated = Connector.parse({ ...existing, status, updatedAt: now() });
      connectors.set(id, updated);
      return updated;
    },

    async updateConnector(id, patch) {
      const existing = connectors.get(id);
      if (!existing) return null;
      const updated = Connector.parse({ ...existing, ...patch, updatedAt: now() });
      connectors.set(id, updated);
      return updated;
    },

    async deleteConnector(id) {
      connectors.delete(id);
    },

    async putComposioOAuthState(input) {
      const record: ComposioOAuthStateRecord = {
        ...input,
        createdAt: now(),
        updatedAt: now(),
      };
      composioOAuthStates.set(record.state, record);
      return record;
    },

    async getComposioOAuthState(state) {
      return composioOAuthStates.get(state) ?? null;
    },

    async consumeComposioOAuthState(state) {
      const existing = composioOAuthStates.get(state);
      if (!existing) return null;
      const updated: ComposioOAuthStateRecord = {
        ...existing,
        consumed: true,
        updatedAt: now(),
      };
      composioOAuthStates.set(state, updated);
      return updated;
    },

    async createCapability(input: NewCapability) {
      const capability = Capability.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        name: input.name,
        skillId: input.skillId,
        connectorId: input.connectorId,
        policyIds: input.policyIds ?? [],
        context: input.context ?? {},
        spaceId: input.spaceId,
      });
      capabilities.set(capability.id, capability);
      return capability;
    },

    async getCapability(id) {
      return capabilities.get(id) ?? null;
    },

    async listCapabilities(filter) {
      const all = [...capabilities.values()];
      if (!filter?.spaceId) return all;
      return all.filter((c) => c.spaceId === filter.spaceId);
    },

    async createPolicy(input: NewPolicy) {
      const policy = Policy.parse({
        id: uuid(),
        spaceId: input.spaceId,
        name: input.name,
        capability: input.capability,
        resource: input.resource ?? "*",
        minRole: input.minRole ?? null,
        riskThreshold: input.riskThreshold ?? 0.5,
        decision: input.decision,
      });
      policies.set(policy.id, policy);
      return policy;
    },

    async listPolicies(filter) {
      const all = [...policies.values()];
      if (!filter?.spaceId) return all;
      return all.filter((p) => p.spaceId === filter.spaceId);
    },

    async putSecret(secret) {
      secrets.set(secret.ref, secret);
    },

    async getSecret(ref) {
      return secrets.get(ref) ?? null;
    },

    async deleteSecret(ref) {
      secrets.delete(ref);
    },

    async createSupplier(input: NewSupplier) {
      const supplier = Supplier.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        actorId: input.actorId,
        organizationId: input.organizationId ?? null,
        onboardingStatus: input.onboardingStatus ?? "active",
        defaultCurrency: input.defaultCurrency ?? "USD",
        terms: input.terms ?? null,
      });
      supplierStore.set(supplier.id, supplier);
      return supplier;
    },

    async getSupplier(id) {
      return supplierStore.get(id) ?? null;
    },

    async getSupplierByActor(actorId) {
      for (const supplier of supplierStore.values()) {
        if (supplier.actorId === actorId) return supplier;
      }
      return null;
    },

    async listSuppliers(filter) {
      const all = [...supplierStore.values()];
      if (!filter?.organizationId) return all;
      return all.filter((s) => s.organizationId === filter.organizationId);
    },

    async updateSupplier(id, patch) {
      const existing = supplierStore.get(id);
      if (!existing) return null;
      const updated = Supplier.parse({ ...existing, ...patch, updatedAt: now() });
      supplierStore.set(id, updated);
      return updated;
    },

    async createProduct(input: NewProduct) {
      const product = Product.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
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
      });
      productStore.set(product.id, product);
      return product;
    },

    async getProduct(id) {
      return productStore.get(id) ?? null;
    },

    async listProducts(filter) {
      const items = [...productStore.values()];
      return filter?.spaceId
        ? items.filter((p) => p.spaceId === filter.spaceId)
        : items;
    },

    async createCatalog(input: NewCatalog) {
      const catalog = Catalog.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        ownerOrganizationId: input.ownerOrganizationId,
        name: input.name,
        version: input.version ?? "1.0.0",
        visibility: input.visibility ?? "private",
        source: input.source ?? "native",
        sourceOfTruth: input.sourceOfTruth ?? "server",
        syncRef: input.syncRef ?? null,
        lastSyncAt: input.lastSyncAt ?? null,
        status: input.status ?? "draft",
      });
      catalogStore.set(catalog.id, catalog);
      return catalog;
    },

    async getCatalog(id) {
      return catalogStore.get(id) ?? null;
    },

    async listCatalogs(filter) {
      const all = [...catalogStore.values()];
      if (!filter?.ownerOrganizationId) return all;
      return all.filter((c) => c.ownerOrganizationId === filter.ownerOrganizationId);
    },

    async updateCatalog(id, patch) {
      const existing = catalogStore.get(id);
      if (!existing) return null;
      const updated = Catalog.parse({ ...existing, ...patch, updatedAt: now() });
      catalogStore.set(id, updated);
      return updated;
    },

    async createCatalogOffer(input: NewCatalogOffer) {
      const offer = CatalogOffer.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        catalogId: input.catalogId,
        productId: input.productId,
        sellerOrganizationId: input.sellerOrganizationId,
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
      });
      catalogOfferStore.set(offer.id, offer);
      return offer;
    },

    async getCatalogOffer(id) {
      return catalogOfferStore.get(id) ?? null;
    },

    async listCatalogOffers(filter) {
      let all = [...catalogOfferStore.values()];
      if (filter?.catalogId) all = all.filter((o) => o.catalogId === filter.catalogId);
      if (filter?.sellerOrganizationId) {
        all = all.filter((o) => o.sellerOrganizationId === filter.sellerOrganizationId);
      }
      if (filter?.spaceId) all = all.filter((o) => o.spaceId === filter.spaceId);
      return all;
    },

    async updateCatalogOffer(id, patch) {
      const existing = catalogOfferStore.get(id);
      if (!existing) return null;
      const updated = CatalogOffer.parse({ ...existing, ...patch, updatedAt: now() });
      catalogOfferStore.set(id, updated);
      return updated;
    },

    async createBuyerAgreement(input: NewBuyerAgreement) {
      const agreement = BuyerAgreement.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        catalogOfferId: input.catalogOfferId,
        buyerOrganizationId: input.buyerOrganizationId,
        priceTiers: input.priceTiers,
        validityFrom: input.validityFrom ?? null,
        validityTo: input.validityTo ?? null,
      });
      buyerAgreementStore.set(agreement.id, agreement);
      return agreement;
    },

    async listBuyerAgreements(filter) {
      let all = [...buyerAgreementStore.values()];
      if (filter?.catalogOfferId) {
        all = all.filter((a) => a.catalogOfferId === filter.catalogOfferId);
      }
      if (filter?.buyerOrganizationId) {
        all = all.filter((a) => a.buyerOrganizationId === filter.buyerOrganizationId);
      }
      return all;
    },

    async createQuoteRequest(input: NewQuoteRequest) {
      const quoteRequest = QuoteRequest.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        buyerOrganizationId: input.buyerOrganizationId,
        title: input.title,
        description: input.description ?? "",
        items: input.items,
        status: input.status ?? "open",
        responseDeadline: input.responseDeadline ?? null,
        metadata: input.metadata ?? null,
      });
      quoteRequestStore.set(quoteRequest.id, quoteRequest);
      return quoteRequest;
    },

    async getQuoteRequest(id) {
      return quoteRequestStore.get(id) ?? null;
    },

    async listQuoteRequests(filter) {
      let all = [...quoteRequestStore.values()];
      if (filter?.buyerOrganizationId) {
        all = all.filter((q) => q.buyerOrganizationId === filter.buyerOrganizationId);
      }
      if (filter?.spaceId) all = all.filter((q) => q.spaceId === filter.spaceId);
      return all;
    },

    async updateQuoteRequestStatus(id, status) {
      const existing = quoteRequestStore.get(id);
      if (!existing) return null;
      const updated = QuoteRequest.parse({ ...existing, status, updatedAt: now() });
      quoteRequestStore.set(id, updated);
      return updated;
    },

    async createQuote(input: NewQuote) {
      const quote = Quote.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        quoteRequestId: input.quoteRequestId,
        sellerOrganizationId: input.sellerOrganizationId,
        items: input.items,
        total: input.total,
        currency: input.currency ?? "USD",
        terms: input.terms ?? null,
        status: input.status ?? "submitted",
        transcript: input.transcript ?? [],
        validUntil: input.validUntil ?? null,
      });
      quoteStore.set(quote.id, quote);
      return quote;
    },

    async getQuote(id) {
      return quoteStore.get(id) ?? null;
    },

    async listQuotes(filter) {
      const all = [...quoteStore.values()];
      if (!filter?.quoteRequestId) return all;
      return all.filter((q) => q.quoteRequestId === filter.quoteRequestId);
    },

    async updateQuoteStatus(id, status) {
      const existing = quoteStore.get(id);
      if (!existing) return null;
      const updated = Quote.parse({ ...existing, status, updatedAt: now() });
      quoteStore.set(id, updated);
      return updated;
    },

    async appendQuoteTranscript(id, message) {
      const existing = quoteStore.get(id);
      if (!existing) return null;
      const updated = Quote.parse({
        ...existing,
        transcript: [...existing.transcript, message],
        updatedAt: now(),
      });
      quoteStore.set(id, updated);
      return updated;
    },

    async createPurchaseOrder(input: NewPurchaseOrder) {
      const purchaseOrder = PurchaseOrder.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        quoteId: input.quoteId,
        buyerOrganizationId: input.buyerOrganizationId,
        sellerOrganizationId: input.sellerOrganizationId,
        items: input.items,
        total: input.total,
        currency: input.currency ?? "USD",
        status: input.status ?? "pending_approval",
        approvedByActorId: input.approvedByActorId ?? null,
        paymentIntentId: null,
      });
      purchaseOrderStore.set(purchaseOrder.id, purchaseOrder);
      return purchaseOrder;
    },

    async getPurchaseOrder(id) {
      return purchaseOrderStore.get(id) ?? null;
    },

    async listPurchaseOrders(filter) {
      let all = [...purchaseOrderStore.values()];
      if (filter?.buyerOrganizationId) {
        all = all.filter((p) => p.buyerOrganizationId === filter.buyerOrganizationId);
      }
      if (filter?.sellerOrganizationId) {
        all = all.filter((p) => p.sellerOrganizationId === filter.sellerOrganizationId);
      }
      if (filter?.spaceId) all = all.filter((p) => p.spaceId === filter.spaceId);
      return all;
    },

    async updatePurchaseOrder(id, patch) {
      const existing = purchaseOrderStore.get(id);
      if (!existing) return null;
      const updated = PurchaseOrder.parse({ ...existing, ...patch, updatedAt: now() });
      purchaseOrderStore.set(id, updated);
      return updated;
    },

    async createPaymentIntent(input: NewPaymentIntent) {
      const intent = PaymentIntent.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        purchaseOrderId: input.purchaseOrderId,
        buyerOrganizationId: input.buyerOrganizationId,
        sellerOrganizationId: input.sellerOrganizationId,
        currency: input.currency ?? "USD",
        estimatedAmount: input.estimatedAmount,
        status: input.status ?? "draft",
        provider: input.provider ?? "ledger",
        requiresApproval: input.requiresApproval ?? true,
        approvedByActorId: input.approvedByActorId ?? null,
        providerReference: input.providerReference ?? null,
        metadata: input.metadata ?? null,
      });
      paymentIntentStore.set(intent.id, intent);
      return intent;
    },

    async getPaymentIntent(id) {
      return paymentIntentStore.get(id) ?? null;
    },

    async listPaymentIntents(filter) {
      let all = [...paymentIntentStore.values()];
      if (filter?.buyerOrganizationId) {
        all = all.filter((p) => p.buyerOrganizationId === filter.buyerOrganizationId);
      }
      if (filter?.sellerOrganizationId) {
        all = all.filter((p) => p.sellerOrganizationId === filter.sellerOrganizationId);
      }
      if (filter?.purchaseOrderId) {
        all = all.filter((p) => p.purchaseOrderId === filter.purchaseOrderId);
      }
      if (filter?.spaceId) all = all.filter((p) => p.spaceId === filter.spaceId);
      return all;
    },

    async updatePaymentIntent(id, patch) {
      const existing = paymentIntentStore.get(id);
      if (!existing) return null;
      const updated = PaymentIntent.parse({ ...existing, ...patch, updatedAt: now() });
      paymentIntentStore.set(id, updated);
      return updated;
    },

    async createPaymentRecord(input: NewPaymentRecord) {
      const record = PaymentRecord.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        paymentIntentId: input.paymentIntentId,
        paidAmount: input.paidAmount,
        currency: input.currency ?? "USD",
        providerReference: input.providerReference ?? null,
        settledAt: input.settledAt ?? null,
      });
      paymentRecordStore.set(record.id, record);
      return record;
    },

    async listPaymentRecords(paymentIntentId) {
      return [...paymentRecordStore.values()].filter(
        (r) => r.paymentIntentId === paymentIntentId,
      );
    },

    async createOutreachList(input: NewOutreachList) {
      const list = OutreachList.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        spaceId: input.spaceId,
        name: input.name,
        description: input.description ?? "",
        memberPersonIds: input.memberPersonIds ?? [],
      });
      outreachLists.set(list.id, list);
      return list;
    },

    async getOutreachList(id) {
      return outreachLists.get(id) ?? null;
    },

    async listOutreachLists(spaceId) {
      return [...outreachLists.values()].filter((l) => l.spaceId === spaceId);
    },

    async updateOutreachList(id, patch) {
      const existing = outreachLists.get(id);
      if (!existing) return null;
      const updated = OutreachList.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      outreachLists.set(id, updated);
      return updated;
    },

    async deleteOutreachList(id) {
      outreachLists.delete(id);
    },

    async createOutreachCampaign(input: NewOutreachCampaign) {
      const campaign = OutreachCampaign.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        spaceId: input.spaceId,
        name: input.name,
        description: input.description ?? "",
        listId: input.listId,
        agentId: input.agentId,
        goal: input.goal,
        status: input.status ?? "draft",
        startedAt: input.startedAt ?? null,
      });
      outreachCampaigns.set(campaign.id, campaign);
      return campaign;
    },

    async getOutreachCampaign(id) {
      return outreachCampaigns.get(id) ?? null;
    },

    async listOutreachCampaigns(filter) {
      let all = [...outreachCampaigns.values()];
      if (filter?.spaceId) all = all.filter((c) => c.spaceId === filter.spaceId);
      if (filter?.status) all = all.filter((c) => c.status === filter.status);
      return all;
    },

    async updateOutreachCampaign(id, patch) {
      const existing = outreachCampaigns.get(id);
      if (!existing) return null;
      const updated = OutreachCampaign.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      outreachCampaigns.set(id, updated);
      return updated;
    },

    async deleteOutreachCampaign(id) {
      outreachCampaigns.delete(id);
    },

    async createOutreachStep(input: NewOutreachStep) {
      const step = OutreachStep.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        campaignId: input.campaignId,
        position: input.position ?? 0,
        sendAfterDays: input.sendAfterDays ?? 0,
        channel: input.channel ?? "whatsapp",
        subject: input.subject ?? "",
        template: input.template ?? "",
        instructions: input.instructions ?? "",
      });
      outreachSteps.set(step.id, step);
      return step;
    },

    async listOutreachSteps(campaignId) {
      return [...outreachSteps.values()]
        .filter((s) => s.campaignId === campaignId)
        .sort((a, b) => a.position - b.position);
    },

    async updateOutreachStep(id, patch) {
      const existing = outreachSteps.get(id);
      if (!existing) return null;
      const updated = OutreachStep.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      outreachSteps.set(id, updated);
      return updated;
    },

    async deleteOutreachStep(id) {
      outreachSteps.delete(id);
    },

    async createOutreachSend(input: NewOutreachSend) {
      const send = OutreachSend.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        campaignId: input.campaignId,
        stepId: input.stepId,
        personId: input.personId,
        status: input.status ?? "queued",
        scheduledAt: input.scheduledAt,
        taskId: input.taskId ?? null,
        sentAt: input.sentAt ?? null,
        error: input.error ?? null,
      });
      outreachSends.set(send.id, send);
      return send;
    },

    async getOutreachSend(id) {
      return outreachSends.get(id) ?? null;
    },

    async findOutreachSend(campaignId, stepId, personId) {
      for (const send of outreachSends.values()) {
        if (
          send.campaignId === campaignId &&
          send.stepId === stepId &&
          send.personId === personId
        ) {
          return send;
        }
      }
      return null;
    },

    async listOutreachSends(filter) {
      let all = [...outreachSends.values()];
      if (filter?.campaignId) {
        all = all.filter((s) => s.campaignId === filter.campaignId);
      }
      if (filter?.personId) all = all.filter((s) => s.personId === filter.personId);
      return all.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    },

    async updateOutreachSend(id, patch) {
      const existing = outreachSends.get(id);
      if (!existing) return null;
      const updated = OutreachSend.parse({
        ...existing,
        ...patch,
        updatedAt: now(),
      });
      outreachSends.set(id, updated);
      return updated;
    },

    async createChannelAccount(input) {
      const now = new Date().toISOString();
      const account: ChannelAccountRecord = {
        id: crypto.randomUUID(),
        spaceId: input.spaceId,
        protocol: input.protocol,
        label: input.label,
        identifier: input.identifier ?? null,
        token: input.token ?? null,
        status: "offline",
        createdAt: now,
        updatedAt: now,
      };
      channelAccounts.set(account.id, account);
      return account;
    },

    async listChannelAccounts(spaceId) {
      return [...channelAccounts.values()].filter((a) => a.spaceId === spaceId);
    },

    async listAllChannelAccounts() {
      return [...channelAccounts.values()];
    },

    async getChannelAccount(id) {
      return channelAccounts.get(id) ?? null;
    },

    async updateChannelAccount(id, patch) {
      const account = channelAccounts.get(id);
      if (!account) return null;
      const updated: ChannelAccountRecord = {
        ...account,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.identifier !== undefined ? { identifier: patch.identifier } : {}),
        updatedAt: new Date().toISOString(),
      };
      channelAccounts.set(id, updated);
      return updated;
    },

    async deleteChannelAccount(id) {
      channelAccounts.delete(id);
    },

    async listOrgNodes(organizationId) {
      return [...orgNodes.values()].filter(
        (n) => n.organizationId === organizationId,
      );
    },

    async getOrgNode(id) {
      return orgNodes.get(id) ?? null;
    },

    async createOrgNode(input) {
      const node = OrgNode.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        organizationId: input.organizationId,
        kind: input.kind,
        name: input.name,
        refId: input.refId ?? null,
        config: input.config ?? {},
        position: input.position ?? { x: 0, y: 0 },
      });
      orgNodes.set(node.id, node);
      return node;
    },

    async updateOrgNode(id, patch) {
      const existing = orgNodes.get(id);
      if (!existing) return null;
      const updated = OrgNode.parse({
        ...existing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.config !== undefined ? { config: patch.config } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        updatedAt: now(),
      });
      orgNodes.set(id, updated);
      return updated;
    },

    async deleteOrgNode(id) {
      orgNodes.delete(id);
      for (const [edgeId, edge] of orgEdges) {
        if (edge.fromNodeId === id || edge.toNodeId === id) {
          orgEdges.delete(edgeId);
        }
      }
    },

    async listOrgEdges(organizationId) {
      return [...orgEdges.values()].filter(
        (e) => e.organizationId === organizationId,
      );
    },

    async createOrgEdge(input) {
      if (!orgNodes.has(input.fromNodeId) || !orgNodes.has(input.toNodeId)) {
        throw new Error("both edge endpoints must reference existing nodes");
      }
      const edge = OrgEdge.parse({
        id: uuid(),
        createdAt: now(),
        updatedAt: now(),
        organizationId: input.organizationId,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        relation: input.relation,
        metadata: input.metadata ?? {},
        validFrom: now(),
        validTo: null,
      });
      orgEdges.set(edge.id, edge);
      return edge;
    },

    async deleteOrgEdge(id) {
      orgEdges.delete(id);
    },
  };

  return repo;
}
