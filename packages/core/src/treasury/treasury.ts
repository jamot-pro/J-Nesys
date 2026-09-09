export type TreasuryEntryType = "contribution" | "payment" | "credit" | "debit";

export interface TreasuryLedgerEntry {
  id: string;
  accountId: string;
  entryType: TreasuryEntryType;
  amount: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TreasuryProposal {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  proposedByActorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryService {
  ensureAccount(organizationId: string, currency?: string): Promise<string>;
  ledger(organizationId: string): Promise<TreasuryLedgerEntry[]>;
  propose(
    organizationId: string,
    input: {
      title: string;
      description?: string;
      amount: number;
      proposedByActorId: string;
    },
  ): Promise<TreasuryProposal>;
  approve(proposalId: string): Promise<TreasuryProposal>;
  addContribution(
    actorId: string,
    organizationId: string,
    capability: string,
    amount: number,
  ): Promise<void>;
  /** Posts a settled payment: buyer debit + seller credit (ledger settlement). */
  recordPayment(input: {
    buyerOrganizationId: string;
    sellerOrganizationId: string;
    amount: number;
    currency?: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
}
