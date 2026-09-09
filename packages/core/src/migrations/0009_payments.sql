-- Jamot payment infrastructure (0009).
-- Payment intents are created against approved PurchaseOrders and settle on
-- the internal treasury ledger (ledger provider). Real rails (card/bank/
-- stablecoin) arrive later as PaymentProvider adapters per JAMOT_SPEC §31.

CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL,
  buyer_organization_id uuid NOT NULL,
  seller_organization_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  estimated_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  provider text NOT NULL DEFAULT 'ledger',
  requires_approval boolean NOT NULL DEFAULT true,
  approved_by_actor_id uuid,
  provider_reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_intents_purchase_order_idx ON payment_intents (purchase_order_id);
CREATE INDEX payment_intents_buyer_idx ON payment_intents (buyer_organization_id);
CREATE INDEX payment_intents_seller_idx ON payment_intents (seller_organization_id);

CREATE TABLE payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL,
  paid_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  provider_reference text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_records_intent_idx ON payment_records (payment_intent_id);