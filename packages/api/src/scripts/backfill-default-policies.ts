// One-off, idempotent backfill for spaces created before createSpace()
// started seeding a default policy (see repository/pg.ts). Run once against
// production after that fix ships:
//
//   DATABASE_URL=... pnpm --filter @jamot/api exec tsx src/scripts/backfill-default-policies.ts
//
// Safe to re-run: any space that already has at least one policy is skipped.
import { createDb } from "@jamot/core";
import { createPgRepositoryFromDb } from "../pgRepository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(databaseUrl);
const repo = createPgRepositoryFromDb(db);

const spaces = await repo.listSpaces();
let seeded = 0;
let skipped = 0;

for (const space of spaces) {
  const existing = await repo.listPolicies({ spaceId: space.id });
  if (existing.length > 0) {
    skipped += 1;
    continue;
  }
  await repo.createPolicy({
    spaceId: space.id,
    name: "Default — allow",
    capability: "*",
    resource: "*",
    minRole: null,
    riskThreshold: 0.5,
    decision: "allow",
  });
  seeded += 1;
}

console.log(
  JSON.stringify({ totalSpaces: spaces.length, seeded, skipped }, null, 2),
);
