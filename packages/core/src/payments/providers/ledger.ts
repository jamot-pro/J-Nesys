import { randomUUID } from "node:crypto";
import type { PaymentProvider, PaymentProviderContext } from "../payment-provider.js";

export interface LedgerSettleInput {
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, unknown>;
}

export type LedgerSettle = (input: LedgerSettleInput) => Promise<void>;

export interface LedgerPaymentProviderOptions {
  settle: LedgerSettle;
}

/**
 * MVP ledger provider: settles PaymentIntents by posting buyer debit + seller
 * credit entries through the treasury ledger (spec §31 default transport).
 */
export function createLedgerPaymentProvider(opts: LedgerPaymentProviderOptions): PaymentProvider {
  return {
    kind: "ledger",
    createPayment: async () => ({
      externalPaymentId: "ledger:" + randomUUID(),
      transport: { transportId: "ledger" },
    }),
    confirmPayment: async ({ intent, externalPaymentId }) => {
      await opts.settle({
        buyerOrganizationId: intent.buyerOrganizationId,
        sellerOrganizationId: intent.sellerOrganizationId,
        amount: intent.estimatedAmount,
        currency: intent.currency,
        description: `payment ${intent.id}`,
        metadata: { paymentIntentId: intent.id, externalPaymentId, provider: "ledger" },
      });
      return { transport: { transportId: "ledger" } };
    },
    cancelPayment: async () => {},
    refundPayment: async ({ intent, externalPaymentId }) => {
      await opts.settle({
        buyerOrganizationId: intent.sellerOrganizationId,
        sellerOrganizationId: intent.buyerOrganizationId,
        amount: intent.estimatedAmount,
        currency: intent.currency,
        description: `refund ${intent.id}`,
        metadata: { paymentIntentId: intent.id, externalPaymentId, provider: "ledger", type: "refund" },
      });
    },
  };
}