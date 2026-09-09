import { describe, expect, it } from "vitest";
import { Id } from "@jamot/contracts";
import { createMemoryRepository } from "../repository/memory.js";
import { createPaymentService } from "./payments.js";
import { createLedgerPaymentProvider } from "./providers/ledger.js";

const PO_ID = "00000000-0000-4000-8000-0000000000aa";
const ORG_BUYER = "00000000-0000-4000-8000-000000000001";
const ORG_SELLER = "00000000-0000-4000-8000-000000000002";
const ACTOR = "00000000-0000-4000-8000-000000000003";

async function setup(settle?: (amount: number, buyer: string, seller: string) => Promise<void>) {
  const repo = createMemoryRepository();
  const settled: Array<{ buyer: string; seller: string; amount: number }> = [];
  const payments = createPaymentService({
    repo,
    providers: {
      ledger: createLedgerPaymentProvider({
        settle: async ({ buyerOrganizationId, sellerOrganizationId, amount }) => {
          settled.push({ buyer: buyerOrganizationId, seller: sellerOrganizationId, amount });
          if (settle) await settle(amount, buyerOrganizationId, sellerOrganizationId);
        },
      }),
    },
    defaultProvider: "ledger",
  });
  return { repo, payments, settled };
}

describe("payment service — ledger provider", () => {
  it("creates intents in pending_approval when required approval", async () => {
    const { payments } = await setup();
    const intent = await payments.createIntent({
      purchaseOrderId: "00000000-0000-4000-8000-0000000000aa",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      estimatedAmount: 500,
      requiresApproval: true,
    });
    expect(intent.status).toBe("pending_approval");
    expect(intent.provider).toBe("ledger");
  });

  it("rejects confirming an unapproved required-approval intent", async () => {
    const { payments } = await setup();
    const intent = await payments.createIntent({
      purchaseOrderId: "00000000-0000-4000-8000-0000000000aa",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      estimatedAmount: 500,
      requiresApproval: true,
    });
    await expect(payments.confirmPayment(intent.id, ACTOR)).rejects.toThrow(
      "intent requires approval",
    );
  });

  it("settles an approved intent on the ledger through the provider", async () => {
    const { repo, payments, settled } = await setup();
    const intent = await payments.createIntent({
      purchaseOrderId: "00000000-0000-4000-8000-0000000000aa",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      estimatedAmount: 250,
      requiresApproval: true,
    });
    await payments.approveIntent(intent.id, ACTOR);
    const paid = await payments.confirmPayment(intent.id, ACTOR);

    expect(paid.status).toBe("paid");
    expect(paid.approvedByActorId).toBe(ACTOR);
    expect(settled).toEqual([
      { buyer: ORG_BUYER, seller: ORG_SELLER, amount: 250 },
    ]);
    expect(paid.providerReference).toBeTruthy();

    const records = await payments.listRecords(intent.id);
    expect(records).toHaveLength(1);
    expect(records[0]?.paidAmount).toBe(250);
  });

  it("enforces the state machine — cannot cancel a paid intent", async () => {
    const { payments } = await setup();
    const intent = await payments.createIntent({
      purchaseOrderId: "00000000-0000-4000-8000-0000000000aa",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      estimatedAmount: 50,
      provider: "ledger",
    });
    await payments.confirmPayment(intent.id, ACTOR);
    await expect(payments.cancelIntent(intent.id)).rejects.toThrow("invalid payment intent transition");
  });

  it("refunds a paid intent by reversing the ledger flow", async () => {
    const { payments, settled } = await setup();
    const intent = await payments.createIntent({
      purchaseOrderId: "00000000-0000-4000-8000-0000000000aa",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      estimatedAmount: 120,
    });
    await payments.confirmPayment(intent.id, ACTOR);
    const refunded = await payments.refund(intent.id);
    expect(refunded.status).toBe("refunded");
    // the refund settles seller -> buyer
    expect(settled[1]).toEqual({ buyer: ORG_SELLER, seller: ORG_BUYER, amount: 120 });
  });

  it("creates an intent for a purchase order (auto-approve)", async () => {
    const { repo, payments } = await setup();
    const po = await repo.createPurchaseOrder({
      quoteId: "00000000-0000-4000-8000-0000000000bb",
      buyerOrganizationId: ORG_BUYER,
      sellerOrganizationId: ORG_SELLER,
      items: [
        {
          productId: Id.parse("00000000-0000-4000-8000-00000000000c"),
          productName: "Widget",
          quantity: 3,
          unitOfMeasure: "each",
          unitPrice: 25,
          lineTotal: 75,
        },
      ],
      total: 75,
      currency: "USD",
      status: "approved",
      approvedByActorId: ACTOR,
    });
    const intent = await payments.intentForPurchaseOrder(po);
    expect(intent.purchaseOrderId).toBe(po.id);
    expect(intent.estimatedAmount).toBe(75);
    expect(intent.status).toBe("approved");
  });
});