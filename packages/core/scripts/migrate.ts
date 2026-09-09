import { runMigrations } from "../src/migrate.ts";

void runMigrations().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
