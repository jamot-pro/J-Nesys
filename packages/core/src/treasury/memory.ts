import { randomUUID } from "node:crypto";
import type {
  TreasuryLedgerEntry,
  TreasuryProposal,
  TreasuryService,
} from "./treasury.js";

const nowIso = () => new Date().toISOString();

export function createInMemoryTreasuryService(): TreasuryService {
  const accounts = new Map<string, string>();
  const ledgerByAccount = new Map<string, TreasuryLedgerEntry[]>();
  const proposals = new Map<string, TreasuryProposal>();

  async function ensureAccount(
    organizationId: string,
    currency = "USD",
  ): Promise<string> {
    const existing = accounts.get(organizationId);
    if (existing) return existing;
    const id = randomUUID();
    accounts.set(organizationId, id);
    ledgerByAccount.set(id, []);
    return id;
  }

  async function getAccountId(
    organizationId: string,
  ): Promise<string | null> {
    return accounts.get(organizationId) ?? null;
  }

  return {
    ensureAccount,

    async ledger(organizationId) {
      const accountId = await getAccountId(organizationId);
      if (!accountId) return [];
      return [...(ledgerByAccount.get(accountId) ?? [])];
    },

    async propose(organizationId, input) {
      const ts = nowIso();
      const proposal: TreasuryProposal = {
        id: randomUUID(),
        organizationId,
        title: input.title,
        description: input.description ?? null,
        amount: input.amount,
        status: "proposed",
        proposedByActorId: input.proposedByActorId,
        createdAt: ts,
        updatedAt: ts,
      };
      proposals.set(proposal.id, proposal);
      return proposal;
    },

    async approve(proposalId) {
      const proposal = proposals.get(proposalId);
      if (!proposal) throw new Error("proposal not found");
      const accountId = await ensureAccount(proposal.organizationId);
      const entry: TreasuryLedgerEntry = {
        id: randomUUID(),
        accountId,
        entryType: "payment",
        amount: -proposal.amount,
        description: proposal.title,
        metadata: { proposalId: proposal.id },
        createdAt: nowIso(),
      };
      const list = ledgerByAccount.get(accountId) ?? [];
      list.push(entry);
      ledgerByAccount.set(accountId, list);
      const approved: TreasuryProposal = {
        ...proposal,
        status: "approved",
        updatedAt: nowIso(),
      };
      proposals.set(proposalId, approved);
      return approved;
    },

    async addContribution(actorId, organizationId, capability, amount) {
      const accountId = await ensureAccount(organizationId);
      const entry: TreasuryLedgerEntry = {
        id: randomUUID(),
        accountId,
        entryType: "credit",
        amount,
        description: capability,
        metadata: { actorId, capability },
        createdAt: nowIso(),
      };
      const list = ledgerByAccount.get(accountId) ?? [];
      list.push(entry);
      ledgerByAccount.set(accountId, list);
    },

    async recordPayment(input) {
      const buyerAccountId = await ensureAccount(input.buyerOrganizationId);
      const sellerAccountId = await ensureAccount(input.sellerOrganizationId);
      const metadata = { ...(input.metadata ?? {}), paymentIntentId: input.metadata?.paymentIntentId };
      const entryBase = {
        description: input.description ?? null,
        metadata,
        createdAt: nowIso(),
      };
      const buyerList = ledgerByAccount.get(buyerAccountId) ?? [];
      const sellerList = ledgerByAccount.get(sellerAccountId) ?? [];
      buyerList.push({
        id: randomUUID(),
        accountId: buyerAccountId,
        entryType: "debit",
        amount: -input.amount,
        ...entryBase,
      } as TreasuryLedgerEntry);
      sellerList.push({
        id: randomUUID(),
        accountId: sellerAccountId,
        entryType: "credit",
        amount: input.amount,
        ...entryBase,
      } as TreasuryLedgerEntry);
      ledgerByAccount.set(buyerAccountId, buyerList);
      ledgerByAccount.set(sellerAccountId, sellerList);
    },
  };
}
