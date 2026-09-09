import type {
  PaymentIntent,
  PaymentIntentStatus,
  PaymentProviderKind,
  PaymentRecord,
  PurchaseOrder,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { PaymentProvider, PaymentProviderContext } from "./payment-provider.js";

export interface CreatePaymentIntentInput {
  purchaseOrderId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  estimatedAmount: number;
  currency?: string;
  provider?: PaymentProviderKind;
  requiresApproval?: boolean;
  approvedByActorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentService {
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  approveIntent(intentId: string, actorId: string): Promise<PaymentIntent>;
  confirmPayment(intentId: string, actorId: string): Promise<PaymentIntent>;
  cancelIntent(intentId: string): Promise<PaymentIntent>;
  refund(intentId: string): Promise<PaymentIntent>;
  get(intentId: string): Promise<PaymentIntent | null>;
  listByOrganization(
    organizationId: string,
    role: "buyer" | "seller",
    spaceId?: string,
  ): Promise<PaymentIntent[]>;
  listAll(spaceId?: string): Promise<PaymentIntent[]>;
  listRecords(intentId: string): Promise<PaymentRecord[]>;
  intentForPurchaseOrder(po: PurchaseOrder): Promise<PaymentIntent>;
}

export interface PaymentServiceOptions {
  repo: JamotRepository;
  providers: Partial<Record<PaymentProviderKind, PaymentProvider>>;
  defaultProvider?: PaymentProviderKind;
}

const ALLOWED_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved: ["processing", "cancelled"],
  processing: ["paid", "failed"],
  paid: ["refunded"],
  failed: ["cancelled"],
  cancelled: [],
  refunded: [],
};

export function createPaymentService(opts: PaymentServiceOptions): PaymentService {
  const { repo } = opts;
  const defaultProvider = opts.defaultProvider ?? "ledger";

  function assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus) {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new Error(`invalid payment intent transition ${from} -> ${to}`);
    }
  }

  function providerFor(kind: PaymentProviderKind): PaymentProvider {
    const provider = opts.providers[kind];
    if (!provider) throw new Error(`no payment provider registered for ${kind}`);
    return provider;
  }

  async function execOnProvider(
    intent: PaymentIntent,
    fn: (
      provider: PaymentProvider,
      externalPaymentId: string,
      context: PaymentProviderContext,
    ) => Promise<PaymentProviderContext | void>,
  ) {
    const provider = providerFor(intent.provider);
    const metaExternalId = intent.metadata?.externalPaymentId;
    const externalPaymentId =
      intent.providerReference ?? (typeof metaExternalId === "string" ? metaExternalId : undefined);
    if (!externalPaymentId) throw new Error("intent has no provider reference");
    const ctx: PaymentProviderContext = { ...(intent.metadata ?? {}), transportId: intent.provider };
    const updated = await fn(provider, externalPaymentId, ctx);
    if (updated) ctx.transport = updated;
    return ctx;
  }

  return {
    async createIntent(input) {
      const status: PaymentIntentStatus = input.requiresApproval ? "pending_approval" : "approved";
      return repo.createPaymentIntent({
        purchaseOrderId: input.purchaseOrderId,
        buyerOrganizationId: input.buyerOrganizationId,
        sellerOrganizationId: input.sellerOrganizationId,
        currency: input.currency ?? "USD",
        estimatedAmount: input.estimatedAmount,
        provider: input.provider ?? defaultProvider,
        requiresApproval: input.requiresApproval ?? false,
        approvedByActorId: input.approvedByActorId ?? null,
        metadata: input.metadata ?? null,
        status,
      });
    },

    async approveIntent(intentId, actorId) {
      const intent = await repo.getPaymentIntent(intentId);
      if (!intent) throw new Error("payment intent not found");
      assertTransition(intent.status, "approved");
      const approved = await repo.updatePaymentIntent(intentId, {
        status: "approved",
        approvedByActorId: actorId,
      });
      if (!approved) throw new Error("failed to approve payment intent");
      return approved;
    },

    async confirmPayment(intentId, actorId) {
      const intent = await repo.getPaymentIntent(intentId);
      if (!intent) throw new Error("payment intent not found");
      if (intent.requiresApproval && intent.status !== "approved") {
        throw new Error(`intent requires approval before settlement (status ${intent.status})`);
      }
      assertTransition(intent.status, "processing");

      const provider = providerFor(intent.provider);
      let providerReference = intent.providerReference;
      if (!providerReference) {
        const created = await provider.createPayment({ intent });
        providerReference = created.externalPaymentId;
      }

      await provider.confirmPayment({
        intent: { ...intent, providerReference: providerReference ?? null } as PaymentIntent,
        externalPaymentId: providerReference!,
      });

      await repo.updatePaymentIntent(intentId, {
        status: "processing",
        providerReference: providerReference ?? null,
        metadata: { ...(intent.metadata ?? {}), externalPaymentId: providerReference ?? null },
      });

      await repo.createPaymentRecord({
        paymentIntentId: intentId,
        paidAmount: intent.estimatedAmount,
        currency: intent.currency,
        providerReference: providerReference ?? null,
        settledAt: new Date().toISOString(),
      });

      const paid = await repo.updatePaymentIntent(intentId, { status: "paid" });
      if (!paid) throw new Error("failed to settle payment intent");
      return paid;
    },

    async cancelIntent(intentId) {
      const intent = await repo.getPaymentIntent(intentId);
      if (!intent) throw new Error("payment intent not found");
      assertTransition(intent.status, "cancelled");
      const provider = providerFor(intent.provider);
      const metaExternalId = intent.metadata?.externalPaymentId;
      const externalPaymentId =
        intent.providerReference ?? (typeof metaExternalId === "string" ? metaExternalId : undefined);
      if (externalPaymentId) {
        await provider.cancelPayment({ intent, externalPaymentId });
      }
      const cancelled = await repo.updatePaymentIntent(intentId, { status: "cancelled" });
      if (!cancelled) throw new Error("failed to cancel payment intent");
      return cancelled;
    },

    async refund(intentId) {
      const intent = await repo.getPaymentIntent(intentId);
      if (!intent) throw new Error("payment intent not found");
      assertTransition(intent.status, "refunded");
      await execOnProvider(intent, async (provider, externalPaymentId) => {
        await provider.refundPayment({ intent, externalPaymentId });
      });
      await repo.createPaymentRecord({
        paymentIntentId: intentId,
        paidAmount: intent.estimatedAmount,
        currency: intent.currency,
        providerReference: intent.providerReference,
        settledAt: new Date().toISOString(),
      });
      const refunded = await repo.updatePaymentIntent(intentId, { status: "refunded" });
      if (!refunded) throw new Error("failed to refund payment intent");
      return refunded;
    },

    async get(intentId) {
      return repo.getPaymentIntent(intentId);
    },

    async listByOrganization(organizationId, role, spaceId?) {
      const list = spaceId
        ? await repo.listPaymentIntents({ spaceId })
        : await repo.listPaymentIntents();
      return role === "buyer"
        ? list.filter((i) => i.buyerOrganizationId === organizationId)
        : list.filter((i) => i.sellerOrganizationId === organizationId);
    },

    async listRecords(intentId) {
      return repo.listPaymentRecords(intentId);
    },

    async listAll(spaceId?) {
      return spaceId ? repo.listPaymentIntents({ spaceId }) : repo.listPaymentIntents();
    },

    async intentForPurchaseOrder(po) {
      return this.createIntent({
        purchaseOrderId: po.id,
        buyerOrganizationId: po.buyerOrganizationId,
        sellerOrganizationId: po.sellerOrganizationId,
        estimatedAmount: po.total,
        currency: po.currency,
        provider: defaultProvider,
        requiresApproval: false,
        metadata: { source: "purchase_order", quoteId: po.quoteId },
      });
    },
  };
}