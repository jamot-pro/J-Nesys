import { createDb } from "@jamot/core";
import type { Db } from "@jamot/core";
import { createPgRepository as createCorePgRepository } from "@jamot/core/repository/pg";
import type {
  JamotRepository,
  StoredUser,
  WaAccountRecord,
  WaAccountStatus,
} from "./repository.js";

interface UserRow {
  person_id: string;
  actor_id: string;
  password_hash: string | null;
  provider: string | null;
  provider_id: string | null;
  is_super_admin: boolean;
}

interface WaAccountRow {
  id: string;
  space_id: string;
  label: string;
  phone: string | null;
  status: WaAccountStatus;
  created_at: string;
  updated_at: string;
}

function toWaAccount(row: WaAccountRow): WaAccountRecord {
  return {
    id: row.id,
    spaceId: row.space_id,
    label: row.label,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Postgres-backed repository. Domain state lives in Postgres via the core
 * repository; auth users persist in the `users` table (see migration 0004).
 */
export function createPgRepository(
  databaseUrl: string = process.env.DATABASE_URL ?? "",
): JamotRepository {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the pg repository");
  return createPgRepositoryFromDb(createDb(databaseUrl));
}

export function createPgRepositoryFromDb(db: Db): JamotRepository {
  const core = createCorePgRepository(db);
  const pool = db.pool;

  async function hydrate(row: UserRow): Promise<StoredUser | null> {
    const [person, actor] = await Promise.all([
      core.getPerson(row.person_id),
      core.getActor(row.actor_id),
    ]);
    if (!person || !actor) return null;
    return {
      person,
      actor,
      passwordHash: row.password_hash,
      provider: row.provider,
      providerId: row.provider_id,
      isSuperAdmin: row.is_super_admin,
    };
  }

  return {
    ...core,
    async createUser(input) {
      await pool.query(
        `INSERT INTO users (person_id, actor_id, email, password_hash, provider, provider_id, is_super_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.person.id,
          input.actor.id,
          input.person.email?.toLowerCase() ?? null,
          input.passwordHash,
          input.provider ?? null,
          input.providerId ?? null,
          input.isSuperAdmin ?? false,
        ],
      );
    },
    async findUserByEmail(email) {
      const { rows } = await pool.query<UserRow>(
        `SELECT person_id, actor_id, password_hash, provider, provider_id, is_super_admin
         FROM users WHERE email = $1 LIMIT 1`,
        [email.toLowerCase()],
      );
      return rows[0] ? hydrate(rows[0]) : null;
    },
    async findUserByProvider(provider, providerId) {
      const { rows } = await pool.query<UserRow>(
        `SELECT person_id, actor_id, password_hash, provider, provider_id, is_super_admin
         FROM users WHERE provider = $1 AND provider_id = $2 LIMIT 1`,
        [provider, providerId],
      );
      return rows[0] ? hydrate(rows[0]) : null;
    },
    async findUserByActor(actorId) {
      const { rows } = await pool.query<UserRow>(
        `SELECT person_id, actor_id, password_hash, provider, provider_id, is_super_admin
         FROM users WHERE actor_id = $1 LIMIT 1`,
        [actorId],
      );
      return rows[0] ? hydrate(rows[0]) : null;
    },
    async setSuperAdmin(personId, enabled) {
      await pool.query(
        `UPDATE users SET is_super_admin = $2, updated_at = now() WHERE person_id = $1`,
        [personId, enabled],
      );
    },
    async updateUserPassword(personId, passwordHash) {
      await pool.query(
        `UPDATE users SET password_hash = $2, updated_at = now() WHERE person_id = $1`,
        [personId, passwordHash],
      );
    },
    async createWaAccount(spaceId, label) {
      const { rows } = await pool.query<WaAccountRow>(
        `INSERT INTO wa_accounts (space_id, label)
         VALUES ($1, $2)
         RETURNING id, space_id, label, phone, status, created_at::text, updated_at::text`,
        [spaceId, label],
      );
      return toWaAccount(rows[0]!);
    },
    async listWaAccounts(spaceId) {
      const { rows } = await pool.query<WaAccountRow>(
        `SELECT id, space_id, label, phone, status, created_at::text, updated_at::text
         FROM wa_accounts WHERE space_id = $1 ORDER BY created_at ASC`,
        [spaceId],
      );
      return rows.map(toWaAccount);
    },
    async getWaAccount(id) {
      const { rows } = await pool.query<WaAccountRow>(
        `SELECT id, space_id, label, phone, status, created_at::text, updated_at::text
         FROM wa_accounts WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ? toWaAccount(rows[0]) : null;
    },
    async updateWaAccount(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (patch.phone !== undefined) {
        params.push(patch.phone);
        sets.push(`phone = $${params.length}`);
      }
      if (patch.status !== undefined) {
        params.push(patch.status);
        sets.push(`status = $${params.length}`);
      }
      if (sets.length === 0) return this.getWaAccount(id);
      params.push(id);
      const { rows } = await pool.query<WaAccountRow>(
        `UPDATE wa_accounts SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${params.length}
         RETURNING id, space_id, label, phone, status, created_at::text, updated_at::text`,
        params,
      );
      return rows[0] ? toWaAccount(rows[0]) : null;
    },
    async deleteWaAccount(id) {
      await pool.query(`DELETE FROM wa_accounts WHERE id = $1`, [id]);
    },
  };
}
