import { asc, eq } from "drizzle-orm";
import type { Db } from "../db.js";
import {
  contributionCredits,
  treasuryAccounts,
  treasuryLedger,
  treasuryProposals,
} from "../schema/index.js";
import type {
  TreasuryLedgerEntry,
  TreasuryProposal,
  TreasuryService,
} from "./treasury.js";

const nowIso = () => new Date().toISOString();

function toLedgerEntry(
  row: typeof treasuryLedger.$inferSelect,
): TreasuryLedgerEntry {
  return {
    id: row.id,
    accountId: row.accountId,
    entryType: row.entryType as TreasuryLedgerEntry["entryType"],
    amount: Number(row.amount),
    description: row.description,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

function toProposal(
  row: typeof treasuryProposals.$inferSelect,
): TreasuryProposal {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    amount: Number(row.amount),
    status: row.status,
    proposedByActorId: row.proposedByActorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPostgresTreasuryService(db: Db): TreasuryService {
  const client = db.db;

  async function ensureAccount(
    organizationId: string,
    currency = "USD",
  ): Promise<string> {
    const [existing] = await client
      .select({ id: treasuryAccounts.id })
      .from(treasuryAccounts)
      .where(eq(treasuryAccounts.organizationId, organizationId))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await client
      .insert(treasuryAccounts)
      .values({ organizationId, currency })
      .returning({ id: treasuryAccounts.id });
    if (!created) throw new Error("failed to create treasury account");
    return created.id;
  }

  async function getAccountId(
    organizationId: string,
  ): Promise<string | null> {
    const [existing] = await client
      .select({ id: treasuryAccounts.id })
      .from(treasuryAccounts)
      .where(eq(treasuryAccounts.organizationId, organizationId))
      .limit(1);
    return existing?.id ?? null;
  }

  return {
    async ensureAccount(organizationId, currency) {
      return ensureAccount(organizationId, currency);
    },

    async ledger(organizationId) {
      const accountId = await getAccountId(organizationId);
      if (!accountId) return [];
      const rows = await client
        .select()
        .from(treasuryLedger)
        .where(eq(treasuryLedger.accountId, accountId))
        .orderBy(asc(treasuryLedger.createdAt));
      return rows.map(toLedgerEntry);
    },

    async propose(organizationId, input) {
      const [row] = await client
        .insert(treasuryProposals)
        .values({
          organizationId,
          title: input.title,
          description: input.description ?? null,
          amount: String(input.amount),
          status: "proposed",
          proposedByActorId: input.proposedByActorId,
        })
        .returning();
      if (!row) throw new Error("failed to create proposal");
      return toProposal(row);
    },

    async approve(proposalId) {
      const [existing] = await client
        .select()
        .from(treasuryProposals)
        .where(eq(treasuryProposals.id, proposalId))
        .limit(1);
      if (!existing) throw new Error("proposal not found");
      const accountId = await ensureAccount(existing.organizationId);
      await client.insert(treasuryLedger).values({
        accountId,
        entryType: "payment",
        amount: String(-Number(existing.amount)),
        description: existing.title,
        metadata: { proposalId: existing.id },
      });
      const [row] = await client
        .update(treasuryProposals)
        .set({ status: "approved", updatedAt: nowIso() })
        .where(eq(treasuryProposals.id, proposalId))
        .returning();
      if (!row) throw new Error("failed to approve proposal");
      return toProposal(row);
    },

    async addContribution(actorId, organizationId, capability, amount) {
      const accountId = await ensureAccount(organizationId);
      await client.insert(treasuryLedger).values({
        accountId,
        entryType: "credit",
        amount: String(amount),
        description: capability,
        metadata: { actorId, capability },
      });
      await client.insert(contributionCredits).values({
        actorId,
        organizationId,
        capability,
        amount: String(amount),
      });
    },

    async recordPayment(input) {
      const buyerAccountId = await ensureAccount(input.buyerOrganizationId);
      const sellerAccountId = await ensureAccount(input.sellerOrganizationId);
      const amount = input.amount;
      const metadata = { ...(input.metadata ?? {}), paymentIntentId: input.metadata?.paymentIntentId };
      await client.insert(treasuryLedger).values([
        {
          accountId: buyerAccountId,
          entryType: "debit",
          amount: String(-amount),
          description: input.description ?? "payment out",
          metadata,
        },
        {
          accountId: sellerAccountId,
          entryType: "credit",
          amount: String(amount),
          description: input.description ?? "payment in",
          metadata,
        },
      ]);
    },
  };
}
