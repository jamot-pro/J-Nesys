"use client";

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import {
  approvePaymentIntent,
  approvePurchaseOrder,
  confirmPaymentIntent,
  fulfillPurchaseOrder,
  listPaymentIntents,
  listPurchaseOrders,
  registerSupplier,
  searchNetworkHits,
} from "@/lib/api-client";

/**
 * Frontend tools for agentic commerce. The server-side Main Manager (BuiltInAgent)
 * can call these to search the supplier network and drive procurement/payment
 * actions on behalf of the user. High-risk actions (PO approval, payment
 * confirmation) are gated by the agent prompt + the service-level approval
 * threshold; clients should confirm with the human before invoking them.
 */
export function useCommerceTools() {
  useFrontendTool(
    {
      name: "searchSupplierNetwork",
      description:
        "Search the JAMOT supplier network for purchasable catalog offers. Use it whenever the user wants to find suppliers, source a product, compare unit prices, or check quantity/lead-time constraints. Returns offers of published catalogs from active suppliers ranked by match score.",
      parameters: z.object({
        q: z
          .string()
          .describe("Free-text query matched against product names, SKUs and GTINs"),
        minQty: z
          .number()
          .optional()
          .describe("Minimum order quantity; pricing returned for this quantity"),
      }),
      handler: async ({ q, minQty }) => {
        const hits = await searchNetworkHits({
          q: q ?? undefined,
          minQty: minQty ?? undefined,
        });
        return hits.map((hit) => ({
          productName: hit.productName,
          productId: hit.productId,
          sellerOrganizationId: hit.sellerOrganizationId,
          currency: hit.currency,
          unitPrice: hit.unitPrice,
          priceQuantity: hit.priceQuantity,
          minQty: hit.minQty,
          orderIncrement: hit.orderIncrement,
          leadTime: hit.leadTime,
          availability: hit.availability,
          reputation: hit.reputation,
          offerId: hit.offerId,
        }));
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "registerSupplier",
      description:
        "Register an existing person or agent as a supplier in the JAMOT supplier network. Use it when the user wants to add a supplier, onboard a vendor, or mark a counterparty as a supplier. Resolve the actor first with the searchPeople or searchAgents tools and pass its actorId — never guess or invent an actorId. Confirm the supplier's name with the user before registering.",
      parameters: z.object({
        actorId: z.string().describe("The actorId of the person or agent to register as a supplier"),
        organizationId: z
          .string()
          .optional()
          .describe("The supplier's organization (commercial counterparty) id, if known"),
        terms: z
          .string()
          .optional()
          .describe("Free-text commercial terms agreed with the supplier"),
      }),
      handler: async ({ actorId, organizationId, terms }) => {
        const supplier = await registerSupplier({
          actorId,
          organizationId: organizationId ?? null,
          terms: terms ?? null,
        });
        return {
          id: supplier.id,
          actorId: supplier.actorId,
          organizationId: supplier.organizationId,
          onboardingStatus: supplier.onboardingStatus,
          defaultCurrency: supplier.defaultCurrency,
        };
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "listPurchaseOrders",
      description:
        "List purchase orders and the payment intents attached to them, including approval status. Use it to report on procurement pipeline, which POs are pending human approval, and which payments are settled.",
      parameters: z.object({}),
      handler: async () => {
        const [orders, intents] = await Promise.all([
          listPurchaseOrders(),
          listPaymentIntents(),
        ]);
        return orders.map((order) => ({
          id: order.id,
          status: order.status,
          currency: order.currency,
          total: order.total,
          buyerOrganizationId: order.buyerOrganizationId,
          sellerOrganizationId: order.sellerOrganizationId,
          paymentIntentId: order.paymentIntentId,
          intentStatus: intents.find((i) => i.id === order.paymentIntentId)?.status ?? null,
        }));
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "approvePurchaseOrder",
      description:
        "Approve a pending purchase order. Only call after the user has been explicitly informed of the order value and explicitly consented — this triggers payment risk assessment and, for amounts at or above the approval threshold, still requires a separate human payment approval.",
      parameters: z.object({
        purchaseOrderId: z.string().describe("The purchase order id to approve"),
      }),
      handler: async ({ purchaseOrderId }) => {
        const order = await approvePurchaseOrder(purchaseOrderId);
        return { id: order.id, status: order.status, paymentIntentId: order.paymentIntentId };
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "fulfillPurchaseOrder",
      description:
        "Mark an approved purchase order as fulfilled (goods/services received). Updates the supplier's procurement reputation. Only call after the user confirms delivery.",
      parameters: z.object({
        purchaseOrderId: z.string().describe("The purchase order id to fulfill"),
      }),
      handler: async ({ purchaseOrderId }) => {
        const order = await fulfillPurchaseOrder(purchaseOrderId);
        return { id: order.id, status: order.status };
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "approvePaymentIntent",
      description:
        "Approve a payment intent for a purchase order so it can be settled on the treasury ledger. Only call after the user explicitly confirms the amount and counterparty.",
      parameters: z.object({
        paymentIntentId: z.string().describe("The payment intent id to approve"),
      }),
      handler: async ({ paymentIntentId }) => {
        const intent = await approvePaymentIntent(paymentIntentId);
        return {
          id: intent.id,
          status: intent.status,
          currency: intent.currency,
          estimatedAmount: intent.estimatedAmount,
        };
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "confirmPayment",
      description:
        "Settle an approved payment intent on the treasury ledger (buyer debit, seller credit). Only call after the user explicitly confirms the final amount.",
      parameters: z.object({
        paymentIntentId: z.string().describe("The payment intent id to confirm/settle"),
      }),
      handler: async ({ paymentIntentId }) => {
        const settled = await confirmPaymentIntent(paymentIntentId);
        return {
          id: settled.id,
          status: settled.status,
          currency: settled.currency,
          estimatedAmount: settled.estimatedAmount,
        };
      },
    },
    [],
  );
}

export function CommerceToolBridge() {
  useCommerceTools();
  return null;
}