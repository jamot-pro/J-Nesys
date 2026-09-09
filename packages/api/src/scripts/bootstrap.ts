import { registerPerson } from "../auth.js";
import { createMemoryRepository } from "../repository.js";

const email = process.env.BOOTSTRAP_EMAIL;
const password = process.env.BOOTSTRAP_PASSWORD;

if (!email || !password) {
  console.error("BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD are required");
  process.exit(1);
}

const repo = createMemoryRepository();

const { actor, person, space } = await registerPerson(repo, { email, password });

const orgSpace = await repo.createSpace({
  kind: "organization",
  ownerActorId: actor.id,
  name: "Sample Organization",
});
const organization = await repo.createOrganization({
  spaceId: orgSpace.id,
  dream: "A sample organization",
});
await repo.createRole({ actorId: actor.id, spaceId: orgSpace.id, kind: "owner" });

console.log(
  JSON.stringify(
    {
      personId: person.id,
      actorId: actor.id,
      personalSpaceId: space.id,
      organizationId: organization.id,
      organizationSpaceId: orgSpace.id,
    },
    null,
    2,
  ),
);
