import type {
  CreateLeadList,
  LeadCriteria,
  LeadList,
  LeadListMember,
  LeadProviderView,
  LeadRunResult,
  Person,
  RawLead,
  UpdateLeadList,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { LeadProviderRegistry } from "./registry.js";
import type { LeadProviderContext, LeadProviderServices } from "./types.js";
import { mergeLead } from "./normalize.js";
import { toPersonInput } from "./person-mapper.js";

export interface LeadGenerationService {
  createList(input: CreateLeadList, createdBy: string | null): Promise<LeadList>;
  getList(id: string): Promise<LeadList | null>;
  listLists(filter: { spaceId?: string; organizationId?: string }): Promise<LeadList[]>;
  updateList(id: string, patch: UpdateLeadList): Promise<LeadList | null>;
  deleteList(id: string): Promise<void>;
  listLeads(listId: string): Promise<Array<LeadListMember & { person: Person | null }>>;
  listProviders(ctx: LeadProviderContext): Promise<LeadProviderView[]>;
  runList(id: string): Promise<LeadRunResult>;
  enrichLead(listId: string, personId: string): Promise<Person>;
}

export function createLeadGenerationService(
  repo: JamotRepository,
  registry: LeadProviderRegistry,
  services: LeadProviderServices,
): LeadGenerationService {
  function contextFor(list: LeadList): LeadProviderContext {
    return {
      organizationId: list.organizationId,
      spaceId: list.spaceId,
      config: list.providerConfig,
    };
  }

  function criteriaFor(list: LeadList): LeadCriteria {
    return {
      area: list.area ?? undefined,
      persona: list.persona,
      limit:
        typeof list.providerConfig.limit === "number"
          ? Math.min(Math.max(1, list.providerConfig.limit), 1000)
          : 100,
    };
  }

  async function upsertPerson(lead: RawLead, list: LeadList): Promise<{ person: Person; existing: boolean }> {
    const normalizedEmail = lead.email?.toLowerCase() ?? null;
    if (normalizedEmail) {
      const existing = await repo.findPersonByEmail(normalizedEmail);
      if (existing) {
        // Reuse the existing Person; merge enriched attributes so later runs enrich, not duplicate.
        const profile = existing.profile;
        for (const [key, value] of Object.entries(toPersonInput(lead, list.spaceId).profile.integral)) {
          if (!profile.integral[key]) profile.integral[key] = value;
        }
        if (existing.membershipSpaceIds && !existing.membershipSpaceIds.includes(list.spaceId)) {
          existing.membershipSpaceIds.push(list.spaceId);
        }
        const updated = await repo.updatePerson(existing.id, {
          profile,
          membershipSpaceIds: existing.membershipSpaceIds,
        });
        return { person: updated ?? existing, existing: true };
      }
    }

    const person = await repo.createLeadPerson(toPersonInput(lead, list.spaceId));
    return { person, existing: false };
  }

  return {
    async createList(input, createdBy) {
      return repo.createLeadList({
        spaceId: input.spaceId,
        organizationId: input.organizationId ?? null,
        createdBy,
        name: input.name,
        description: input.description ?? "",
        persona: input.persona ?? { titles: [], seniority: [], functions: [], industries: [], companySizes: [], keywords: [], excludeEmails: [], summary: "" },
        area: input.area ?? null,
        providerId: input.providerId,
        providerConfig: input.providerConfig ?? {},
      });
    },

    async getList(id) {
      return repo.getLeadList(id);
    },

    async listLists(filter) {
      return repo.listLeadLists(filter);
    },

    async updateList(id, patch) {
      return repo.updateLeadList(id, patch);
    },

    async deleteList(id) {
      await repo.deleteLeadListMembers(id);
      await repo.deleteLeadList(id);
    },

    async listLeads(listId) {
      const members = await repo.listLeadListMembers(listId);
      const people = await Promise.all(members.map((m) => repo.getPerson(m.personId)));
      return members.map((member, index) => ({
        ...member,
        person: people[index] ?? null,
      }));
    },

    async listProviders(ctx) {
      const providers = registry.list();
      const views: LeadProviderView[] = [];
      for (const provider of providers) {
        let configured = false;
        let detail = "";
        try {
          configured = await provider.configured(ctx);
          detail = await provider.describe(ctx);
        } catch {
          configured = false;
        }
        views.push({
          id: provider.id,
          label: provider.label,
          kind: provider.kind,
          configured,
          detail,
        });
      }
      return views;
    },

    async runList(id) {
      const list = await repo.getLeadList(id);
      if (!list) throw new Error("lead list not found");

      if (list.status === "running") {
        return {
          listId: list.id,
          status: list.status,
          totalFound: 0,
          added: 0,
          skipped: 0,
          error: "already running",
        };
      }

      const provider = registry.get(list.providerId);
      if (!provider) throw new Error(`unknown lead provider: ${list.providerId}`);

      await repo.updateLeadList(id, { status: "running" });

      try {
        const criteria = criteriaFor(list);
        const ctx = contextFor(list);
        if (!(await provider.configured(ctx))) {
          throw new Error(`lead provider "${list.providerId}" is not configured`);
        }
        const raw = await provider.search(criteria, ctx);

        let added = 0;
        let skipped = 0;
        for (const lead of raw) {
          const { person, existing } = await upsertPerson(lead, list);
          if (existing) {
            skipped += 1;
          } else {
            added += 1;
          }
          await repo.addLeadListMember({
            leadListId: list.id,
            personId: person.id,
            providerId: list.providerId,
            raw: lead.raw,
            provenance: {
              listId: list.id,
              listName: list.name,
              area: list.area ?? null,
              persona: list.persona,
              providerId: list.providerId,
              capturedAt: new Date().toISOString(),
            },
          });
        }

        const completed = await repo.updateLeadList(id, {
          status: "complete",
          error: null,
          leadCount: added + skipped,
          lastRunAt: new Date().toISOString(),
        });
        void completed;

        await repo.recordEvent({
          type: "leads.run.complete",
          spaceId: list.spaceId,
          actorId: null,
          payload: { listId: list.id, found: raw.length, added, skipped },
        });

        return {
          listId: list.id,
          status: "complete",
          totalFound: raw.length,
          added,
          skipped,
          error: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await repo.updateLeadList(id, { status: "failed", error: message });
        await repo.recordEvent({
          type: "leads.run.failed",
          spaceId: list.spaceId,
          actorId: null,
          payload: { listId: list.id, error: message },
        });
        return {
          listId: list.id,
          status: "failed",
          totalFound: 0,
          added: 0,
          skipped: 0,
          error: message,
        };
      }
    },

    async enrichLead(listId, personId) {
      const list = await repo.getLeadList(listId);
      if (!list) throw new Error("lead list not found");
      const members = await repo.listLeadListMembers(listId);
      const member = members.find((m) => m.personId === personId);
      if (!member) throw new Error("lead is not part of this list");

      const person = await repo.getPerson(personId);
      if (!person) throw new Error("person not found");

      const provider = registry.get(member.providerId ?? list.providerId);
      if (!provider?.enrich) return person;

      const base: RawLead = {
        firstName: "",
        lastName: "",
        email: person.email,
        phone: null,
        title: "",
        seniority: "",
        company: "",
        industry: "",
        companySize: "",
        location: "",
        hqLocation: "",
        linkedinUrl: null,
        website: null,
        extra: {},
        raw: member.raw ?? {},
      };

      const enriched = await provider.enrich(base, contextFor(list));
      const merged = mergeLead(base, enriched);
      const input = toPersonInput(merged, list.spaceId);

      const profile = person.profile;
      for (const [key, value] of Object.entries(input.profile.integral)) {
        profile.integral[key] = value;
      }
      const updated = await repo.updatePerson(person.id, {
        profile,
        email: merged.email ?? person.email,
      });

      await repo.updateLeadListMember(member.id, {
        raw: { ...(member.raw ?? {}), enrichedAt: new Date().toISOString() },
      });

      return updated ?? person;
    },
  };
}