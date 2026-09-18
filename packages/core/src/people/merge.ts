import type { Identity, Person } from "@jamot/contracts";

/**
 * The subset of JamotRepository this needs. Kept structural (not imported
 * from repository.ts) so narrower call-site interfaces — e.g.
 * ChannelPersonIngestRepo — can extend with just these signatures rather
 * than depending on the full repository type.
 */
export interface MergeRepo {
  getPerson(id: string): Promise<Person | null>;
  updatePerson(
    id: string,
    patch: Partial<
      Pick<Person, "firstName" | "lastName" | "phone" | "email" | "avatarUrl" | "membershipSpaceIds">
    >,
  ): Promise<Person | null>;
  listIdentitiesForPerson(personId: string): Promise<Identity[]>;
  findIdentity(provider: string, value: string): Promise<Identity | null>;
  updateIdentity(id: string, patch: { personId: Person["id"] }): Promise<Identity | null>;
  removeIdentity(id: string): Promise<void>;
  deletePerson(id: string): Promise<void>;
}

/**
 * Merges `absorbedId` into `keeperId`: fills the keeper's blank fields from
 * the absorbed person, unions space membership, re-points every identity the
 * absorbed person held (dropping any that would now duplicate one the keeper
 * already has), then deletes the absorbed person.
 *
 * This is the same merge mechanic POST /people/merge-candidates/:id/resolve
 * runs after a human approves a merge — this version is called directly by
 * automatic collision detection (Google contact sync, channel ingestion)
 * when the org has opted into auto-merge instead of review-first merging.
 * No-ops if either person is already gone (e.g. a prior collision in the
 * same batch already merged them).
 */
export async function mergePeople(
  repo: MergeRepo,
  input: { keeperId: string; absorbedId: string },
): Promise<void> {
  if (input.keeperId === input.absorbedId) return;
  const keeper = await repo.getPerson(input.keeperId);
  const absorbed = await repo.getPerson(input.absorbedId);
  if (!keeper || !absorbed) return;

  const patch: Parameters<MergeRepo["updatePerson"]>[1] = {};
  if (!keeper.firstName && absorbed.firstName) patch.firstName = absorbed.firstName;
  if (!keeper.lastName && absorbed.lastName) patch.lastName = absorbed.lastName;
  if (!keeper.phone && absorbed.phone) patch.phone = absorbed.phone;
  if (!keeper.email && absorbed.email) patch.email = absorbed.email;
  if (!keeper.avatarUrl && absorbed.avatarUrl) patch.avatarUrl = absorbed.avatarUrl;
  const membership = new Set([...keeper.membershipSpaceIds, ...absorbed.membershipSpaceIds]);
  patch.membershipSpaceIds = [...membership];
  if (Object.keys(patch).length > 0) {
    await repo.updatePerson(keeper.id, patch);
  }

  for (const identity of await repo.listIdentitiesForPerson(absorbed.id)) {
    const clash = await repo.findIdentity(identity.provider, identity.value);
    if (clash && clash.personId === keeper.id) {
      // Keeper already holds this exact identity — drop the duplicate.
      await repo.removeIdentity(identity.id);
    } else {
      await repo.updateIdentity(identity.id, { personId: keeper.id });
    }
  }

  await repo.deletePerson(absorbed.id);
}
