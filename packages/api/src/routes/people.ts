import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id, ProfileAttribute } from "@jamot/contracts";
import type { Person, PersonSummary } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { registerPerson } from "../auth.js";
import { actorRoleInSpace, requireAuth, ROLE_WEIGHT } from "../rbac.js";
import { fail, parse } from "../util.js";

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

const ProfileAttributePatch = z.object({
  value: z.unknown(),
  source: z
    .enum(["self_declared", "assessment", "observed", "manager_feedback", "inferred", "system"])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const ConsentPatch = z.object({
  exportEnabled: z.boolean().optional(),
  visibility: z.enum(["private", "org", "public"]).optional(),
  allowInference: z.boolean().optional(),
});

const PersonPatch = z.object({
  email: z.string().email().nullable().optional(),
  firstName: z.string().max(120).nullable().optional(),
  lastName: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  consent: ConsentPatch.optional(),
  profile: z
    .object({
      selfDescribed: z.record(z.string(), ProfileAttributePatch).optional(),
      integral: z.record(z.string(), ProfileAttributePatch).optional(),
      preferences: z.record(z.string(), ProfileAttributePatch).optional(),
      skills: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
    })
    .optional(),
});

const PeopleQuery = z.object({
  spaceId: Id.optional(),
  q: z.string().max(200).optional(),
  channel: z.string().max(60).optional(),
  sort: z.enum(["recently_active", "recently_added", "name"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
});

const NewIdentityBody = z.object({
  provider: z.string().min(1).max(60),
  value: z.string().min(1).max(320),
  verified: z.boolean().optional(),
});

/** Manual person creation from the People UI (no login credentials). */
const ManualPersonBody = z.object({
  spaceId: Id,
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

function buildAttribute(input: z.infer<typeof ProfileAttributePatch>): z.infer<typeof ProfileAttribute> {
  const timestamp = new Date().toISOString();
  return {
    value: input.value,
    source: input.source ?? "self_declared",
    confidence: input.confidence ?? 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Self, super admin, or admin/owner of any space the person belongs to. */
async function canEditPerson(
  repo: JamotRepository,
  actorId: string,
  person: Person,
): Promise<boolean> {
  if (person.actorId === actorId) return true;
  const user = await repo.findUserByActor(actorId);
  if (user?.isSuperAdmin) return true;
  for (const spaceId of person.membershipSpaceIds) {
    const role = await actorRoleInSpace(repo, actorId as Id, spaceId);
    if (role && ROLE_WEIGHT[role] >= ROLE_WEIGHT.admin) return true;
  }
  return false;
}

async function toSummary(
  repo: JamotRepository,
  person: Person,
  spaceId?: string,
): Promise<PersonSummary> {
  const actor = await repo.getActor(person.actorId);
  const identities = await repo.listIdentitiesForPerson(person.id);
  const channels = [...new Set(identities.map((i) => i.provider))];

  let relationship: string | null = null;
  if (spaceId) {
    const roles = await repo.listRolesForActor(person.actorId);
    const inSpace = roles.find((r) => r.spaceId === spaceId);
    relationship = inSpace?.title ?? (inSpace ? inSpace.kind : null);
  }

  const displayName =
    [person.firstName, person.lastName].filter(Boolean).join(" ") ||
    actor?.displayName ||
    person.phone ||
    person.email ||
    identities[0]?.value ||
    "Unknown";

  return {
    id: person.id,
    actorId: person.actorId,
    displayName,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    avatarUrl: person.avatarUrl,
    channels,
    relationship,
    lastInteractionAt: person.lastInteractionAt,
    createdAt: person.createdAt,
  };
}

export function peopleRoutes(repo: JamotRepository) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post("/people", async (request, reply) => {
      const body = parse(RegisterBody, request.body, reply);
      if (!body) return;

      const existing = await repo.findUserByEmail(body.email.toLowerCase());
      if (existing) return fail(reply, 409, "email already registered");

      const result = await registerPerson(repo, {
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });

      reply.code(201);
      return { person: result.person, actor: result.actor, space: result.space };
    });

    /** Manual person creation (contact without login credentials). */
    app.post("/people/contacts", { preHandler: requireAuth }, async (request, reply) => {
      const body = parse(ManualPersonBody, request.body, reply);
      if (!body) return;

      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as Id, body.spaceId);
      if (!role) return fail(reply, 403, "no access to this space");

      const displayName =
        [body.firstName, body.lastName].filter(Boolean).join(" ") ||
        body.email ||
        body.phone ||
        "Unknown";

      const actor = await repo.createActor({
        type: "human",
        source: "external",
        displayName,
        externalIdentities: [],
      });
      const person = await repo.createPerson({
        actorId: actor.id,
        email: body.email ?? null,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        phone: body.phone ?? null,
        membershipSpaceIds: [body.spaceId],
      });
      await repo.recordEvent({
        type: "person.created",
        spaceId: body.spaceId,
        actorId: actor.id,
        payload: { personId: person.id, source: "manual" },
      });

      reply.code(201);
      return { person, actor };
    });

    app.get("/people", { preHandler: requireAuth }, async (request, reply) => {
      const query = parse(PeopleQuery, request.query, reply);
      if (!query) return;

      const actorId = request.session.actorId!;
      if (query.spaceId) {
        const role = await actorRoleInSpace(repo, actorId as Id, query.spaceId);
        if (!role) return fail(reply, 403, "no access to this space");
      } else {
        const user = await repo.findUserByActor(actorId);
        if (!user?.isSuperAdmin) {
          return fail(reply, 400, "spaceId is required");
        }
      }

      const { items, total } = await repo.searchPeople({
        spaceId: query.spaceId,
        q: query.q,
        channel: query.channel,
        sort: query.sort ?? "recently_active",
        page: query.page ?? 1,
        perPage: query.perPage ?? 50,
      });

      const summaries = await Promise.all(
        items.map((p) => toSummary(repo, p, query.spaceId)),
      );

      return {
        items: summaries,
        total,
        page: query.page ?? 1,
        perPage: query.perPage ?? 50,
      };
    });

    /** Pending merge candidates for review. */
    app.get("/people/merge-candidates", { preHandler: requireAuth }, async (request, reply) => {
      const query = parse(
        z.object({ spaceId: Id.optional(), status: z.enum(["pending", "merged", "dismissed"]).optional() }),
        request.query,
        reply,
      );
      if (!query) return;

      const candidates = await repo.listMergeCandidates({
        spaceId: query.spaceId,
        status: query.status ?? "pending",
      });
      const enriched = await Promise.all(
        candidates.map(async (c) => ({
          ...c,
          personA: await repo.getPerson(c.personAId),
          personB: await repo.getPerson(c.personBId),
        })),
      );
      return { items: enriched };
    });

    /** Merge personB into personA: re-point identities, union memberships. */
    app.post(
      "/people/merge-candidates/:id/resolve",
      { preHandler: requireAuth },
      async (request, reply) => {
        const params = request.params as { id?: string };
        const id = parse(Id, params.id, reply);
        if (!id) return;

        const candidate = (await repo.listMergeCandidates()).find((c) => c.id === id);
        if (!candidate) return fail(reply, 404, "merge candidate not found");

        const actorId = request.session.actorId!;
        const keeper = await repo.getPerson(candidate.personAId);
        if (!keeper) return fail(reply, 404, "person not found");
        if (!(await canEditPerson(repo, actorId, keeper))) {
          return fail(reply, 403, "no permission to merge these people");
        }

        const absorbed = await repo.getPerson(candidate.personBId);

        const patch: Parameters<JamotRepository["updatePerson"]>[1] = {};
        if (absorbed) {
          if (!keeper.firstName && absorbed.firstName) patch.firstName = absorbed.firstName;
          if (!keeper.lastName && absorbed.lastName) patch.lastName = absorbed.lastName;
          if (!keeper.phone && absorbed.phone) patch.phone = absorbed.phone;
          if (!keeper.email && absorbed.email) patch.email = absorbed.email;
          if (!keeper.avatarUrl && absorbed.avatarUrl) {
            patch.avatarUrl = absorbed.avatarUrl;
          }
          const membership = new Set([
            ...keeper.membershipSpaceIds,
            ...absorbed.membershipSpaceIds,
          ]);
          patch.membershipSpaceIds = [...membership];
        }
        if (Object.keys(patch).length > 0) {
          await repo.updatePerson(keeper.id, patch);
        }

        for (const identity of await repo.listIdentitiesForPerson(candidate.personBId)) {
          const clash = await repo.findIdentity(identity.provider, identity.value);
          if (clash && clash.personId === keeper.id) {
            await repo.removeIdentity(identity.id);
          } else {
            await repo.updateIdentity(identity.id, { personId: keeper.id });
          }
        }

        const updated = await repo.updateMergeCandidate(id, { status: "merged" });
        if (absorbed) await repo.deletePerson(absorbed.id);

        await repo.recordEvent({
          type: "person.updated",
          spaceId: candidate.spaceId,
          actorId: keeper.actorId,
          payload: { personId: keeper.id, mergedPersonId: candidate.personBId },
        });

        return updated;
      },
    );

    app.post(
      "/people/merge-candidates/:id/dismiss",
      { preHandler: requireAuth },
      async (request, reply) => {
        const params = request.params as { id?: string };
        const id = parse(Id, params.id, reply);
        if (!id) return;
        const updated = await repo.updateMergeCandidate(id, { status: "dismissed" });
        if (!updated) return fail(reply, 404, "merge candidate not found");
        return updated;
      },
    );

    app.get("/people/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const person = await repo.getPerson(id);
      if (!person) return fail(reply, 404, "person not found");

      const actor = await repo.getActor(person.actorId);
      const identities = await repo.listIdentitiesForPerson(person.id);
      const interactions = (await repo.listEvents({ actorId: person.actorId, limit: 30 })).filter(
        (e) => e.type.startsWith("message.") || e.type.startsWith("person."),
      );

      return { ...person, actor, identities, interactions };
    });

    app.patch("/people/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const patch = parse(PersonPatch, request.body, reply);
      if (!patch) return;

      const actorId = request.session.actorId!;
      const existing = await repo.getPerson(id);
      if (!existing) return fail(reply, 404, "person not found");
      if (!(await canEditPerson(repo, actorId, existing))) {
        return fail(reply, 403, "you can only update people in your spaces");
      }

      const profile = { ...existing.profile };
      if (patch.profile) {
        if (patch.profile.selfDescribed) {
          profile.selfDescribed = { ...profile.selfDescribed };
          for (const [key, value] of Object.entries(patch.profile.selfDescribed)) {
            profile.selfDescribed[key] = buildAttribute(value);
          }
        }
        if (patch.profile.integral) {
          profile.integral = { ...profile.integral };
          for (const [key, value] of Object.entries(patch.profile.integral)) {
            profile.integral[key] = buildAttribute(value);
          }
        }
        if (patch.profile.preferences) {
          profile.preferences = { ...profile.preferences };
          for (const [key, value] of Object.entries(patch.profile.preferences)) {
            profile.preferences[key] = buildAttribute(value);
          }
        }
        if (patch.profile.skills) profile.skills = patch.profile.skills;
        if (patch.profile.goals) profile.goals = patch.profile.goals;
      }

      const update: Parameters<JamotRepository["updatePerson"]>[1] = { profile };
      if (patch.email !== undefined) update.email = patch.email;
      if (patch.firstName !== undefined) update.firstName = patch.firstName;
      if (patch.lastName !== undefined) update.lastName = patch.lastName;
      if (patch.phone !== undefined) update.phone = patch.phone;
      if (patch.avatarUrl !== undefined) update.avatarUrl = patch.avatarUrl;
      if (patch.consent) {
        update.consent = {
          exportEnabled: patch.consent.exportEnabled ?? existing.consent?.exportEnabled ?? true,
          visibility: patch.consent.visibility ?? existing.consent?.visibility ?? "private",
          allowInference: patch.consent.allowInference ?? existing.consent?.allowInference ?? true,
        };
      }

      const updated = await repo.updatePerson(id, update);
      if (!updated) return fail(reply, 404, "person not found");

      await repo.recordEvent({
        type: "person.updated",
        spaceId: updated.membershipSpaceIds[0] ?? null,
        actorId: existing.actorId,
        payload: { personId: id, editorActorId: actorId },
      });

      return updated;
    });

    /** Manually attach a channel identity to a person. */
    app.post("/people/:id/identities", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(NewIdentityBody, request.body, reply);
      if (!body) return;

      const person = await repo.getPerson(id);
      if (!person) return fail(reply, 404, "person not found");
      const actorId = request.session.actorId!;
      if (!(await canEditPerson(repo, actorId, person))) {
        return fail(reply, 403, "no permission to edit this person");
      }

      const holder = await repo.findIdentity(body.provider, body.value);
      if (holder && holder.personId && holder.personId !== id) {
        return fail(reply, 409, "identity already belongs to another person");
      }

      const identity = await repo.addIdentity({
        actorId: person.actorId,
        personId: person.id,
        provider: body.provider,
        value: body.value,
        verified: body.verified ?? false,
        confidence: 1,
        source: "manual",
      });

      await repo.recordEvent({
        type: "person.identity.linked",
        spaceId: person.membershipSpaceIds[0] ?? null,
        actorId: person.actorId,
        payload: { personId: id, provider: body.provider, value: body.value },
      });

      reply.code(201);
      return identity;
    });

    app.delete(
      "/people/:id/identities/:identityId",
      { preHandler: requireAuth },
      async (request, reply) => {
        const params = request.params as { id?: string; identityId?: string };
        const id = parse(Id, params.id, reply);
        if (!id) return;
        const identityId = parse(Id, params.identityId, reply);
        if (!identityId) return;

        const person = await repo.getPerson(id);
        if (!person) return fail(reply, 404, "person not found");
        const actorId = request.session.actorId!;
        if (!(await canEditPerson(repo, actorId, person))) {
          return fail(reply, 403, "no permission to edit this person");
        }

        const identity = (await repo.listIdentitiesForPerson(id)).find(
          (i) => i.id === identityId,
        );
        if (!identity) return fail(reply, 404, "identity not found");

        await repo.removeIdentity(identityId);
        reply.code(204);
      },
    );
  };
}
