import type {
  PaymentIntent,
  PaymentProviderKind,
} from "@jamot/contracts";

export interface PaymentDebit {
  /** Plugin/account from which funds are drawn. */
  from: string;
  /** Plugin/account that receives funds. */
  to: string;
  amountCents: number;
  currency: string;
  memo?: string;
  externalPaymentId?: string;
}

/** Provider transport context attached to a payment intent. */
export interface PaymentProviderContext {
  transportId?: string;
  [key: string]: unknown;
}

/**
 * PaymentProvider seam — spec §31. Each implementation maps a PaymentIntent
 * onto an external payment rail (ledger, card, bank, stablecoin). It owns the
 * actual settlement and idempotency keyed by `externalPaymentId`.
 */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  /** Reserve/create an external payment (idempotent). */
  createPayment(opts: {
    intent: PaymentIntent;
    context?: PaymentProviderContext;
  }): Promise<{ externalPaymentId: string; transport?: PaymentProviderContext }>;
  /** Execute the transfer for the intent. */
  confirmPayment(opts: {
    intent: PaymentIntent;
    externalPaymentId: string;
  }): Promise<{ transport?: PaymentProviderContext }>;
  cancelPayment(opts: {
    intent: PaymentIntent;
    externalPaymentId: string;
  }): Promise<void>;
  /** Reverse a settled payment. */
  refundPayment(opts: {
    intent: PaymentIntent;
    externalPaymentId: string;
  }): Promise<void>;
}