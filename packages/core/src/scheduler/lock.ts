import type { Pool } from "pg";

export async function withAdvisoryLock(
  pool: Pool,
  lockId: number,
  fn: () => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [lockId]);
    await fn();
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockId]);
    } finally {
      client.release();
    }
  }
}

export type SchedulerLock = typeof withAdvisoryLock;
