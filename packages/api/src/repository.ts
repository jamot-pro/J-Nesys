import { z } from "zod";
import type { Actor, Person } from "@jamot/contracts";
import type { JamotRepository as CoreJamotRepository } from "@jamot/core/repository";
import { createMemoryRepository as createCoreMemoryRepository } from "@jamot/core/repository/memory";

export const ROLE_KINDS = ["owner", "admin", "member", "agent", "external"] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];
export const RoleKindSchema = z.enum(ROLE_KINDS);

export interface StoredUser {
  person: Person;
  actor: Actor;
  passwordHash: string | null;
  provider?: string | null;
  providerId?: string | null;
  isSuperAdmin: boolean;
}

export const WA_ACCOUNT_STATUSES = [
  "offline",
  "pairing",
  "connecting",
  "connected",
  "error",
] as const;
export type WaAccountStatus = (typeof WA_ACCOUNT_STATUSES)[number];

export interface WaAccountRecord {
  id: string;
  spaceId: string;
  label: string;
  phone: string | null;
  status: WaAccountStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * The api's repository view: the core domain repository plus the auth user
 * store (person/actor/password-hash + OAuth provider identity).
 */
export interface JamotRepository extends CoreJamotRepository {
  createUser(input: StoredUser): Promise<void>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserByProvider(provider: string, providerId: string): Promise<StoredUser | null>;
  findUserByActor(actorId: string): Promise<StoredUser | null>;
  setSuperAdmin(personId: string, enabled: boolean): Promise<void>;
  updateUserPassword(personId: string, passwordHash: string): Promise<void>;
  createWaAccount(spaceId: string, label: string): Promise<WaAccountRecord>;
  listWaAccounts(spaceId: string): Promise<WaAccountRecord[]>;
  getWaAccount(id: string): Promise<WaAccountRecord | null>;
  updateWaAccount(
    id: string,
    patch: { phone?: string | null; status?: WaAccountStatus },
  ): Promise<WaAccountRecord | null>;
  deleteWaAccount(id: string): Promise<void>;
}

export function createMemoryRepository(): JamotRepository {
  const core = createCoreMemoryRepository();
  const users = new Map<string, StoredUser>();
  const usersByProvider = new Map<string, StoredUser>();
  const usersByActor = new Map<string, StoredUser>();
  const waAccounts = new Map<string, WaAccountRecord>();

  const remember = (input: StoredUser): void => {
    const email = input.person.email;
    if (email) users.set(email.toLowerCase(), input);
    if (input.provider && input.providerId) {
      usersByProvider.set(`${input.provider}:${input.providerId}`, input);
    }
    usersByActor.set(input.actor.id, input);
  };

  return {
    ...core,
    async createUser(input) {
      remember({ ...input, isSuperAdmin: input.isSuperAdmin ?? false });
    },
    async findUserByEmail(email) {
      return users.get(email.toLowerCase()) ?? null;
    },
    async findUserByProvider(provider, providerId) {
      return usersByProvider.get(`${provider}:${providerId}`) ?? null;
    },
    async findUserByActor(actorId) {
      return usersByActor.get(actorId) ?? null;
    },
    async setSuperAdmin(personId, enabled) {
      for (const user of usersByActor.values()) {
        if (user.person.id !== personId) continue;
        const updated = { ...user, isSuperAdmin: enabled };
        usersByActor.set(updated.actor.id, updated);
        if (updated.person.email) users.set(updated.person.email.toLowerCase(), updated);
        if (updated.provider && updated.providerId) {
          usersByProvider.set(`${updated.provider}:${updated.providerId}`, updated);
        }
      }
    },
    async updateUserPassword(personId, passwordHash) {
      for (const user of usersByActor.values()) {
        if (user.person.id !== personId) continue;
        const updated = { ...user, passwordHash };
        usersByActor.set(updated.actor.id, updated);
        if (updated.person.email) users.set(updated.person.email.toLowerCase(), updated);
        if (updated.provider && updated.providerId) {
          usersByProvider.set(`${updated.provider}:${updated.providerId}`, updated);
        }
      }
    },
    async createWaAccount(spaceId, label) {
      const now = new Date().toISOString();
      const account: WaAccountRecord = {
        id: crypto.randomUUID(),
        spaceId,
        label,
        phone: null,
        status: "offline",
        createdAt: now,
        updatedAt: now,
      };
      waAccounts.set(account.id, account);
      return account;
    },
    async listWaAccounts(spaceId) {
      return [...waAccounts.values()].filter((a) => a.spaceId === spaceId);
    },
    async getWaAccount(id) {
      return waAccounts.get(id) ?? null;
    },
    async updateWaAccount(id, patch) {
      const account = waAccounts.get(id);
      if (!account) return null;
      const updated: WaAccountRecord = {
        ...account,
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date().toISOString(),
      };
      waAccounts.set(id, updated);
      return updated;
    },
    async deleteWaAccount(id) {
      waAccounts.delete(id);
    },
  };
}
