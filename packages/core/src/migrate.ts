import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Idempotently applies every un-applied SQL migration in `src/migrations`.
 * Safe to call on every process boot; already-applied files are skipped.
 */
export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL unset — skipping migrations");
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: /(localhost|127\.0\.0\.1|::1)/.test(url)
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const done = await pool.query(
        `SELECT 1 FROM schema_migrations WHERE name = $1`,
        [file],
      );
      if ((done.rowCount ?? 0) > 0) continue;

      const sql = await readFile(join(migrationsDir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    console.log("[migrate] migrations complete");
  } finally {
    await pool.end();
  }
}
