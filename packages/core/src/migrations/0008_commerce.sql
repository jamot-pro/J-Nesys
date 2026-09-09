-- Jamot supplier network + agentic B2B commerce (0008).
-- Supplier is a role/relationship of an Actor (legal counterparty is an
-- Organization); product master data -> catalogs -> catalog offers -> buyer
-- agreements follow GS1/Peppol layering. Procurement: RFQ -> Quote -> PO.

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  organization_id uuid,
  onboarding_status text NOT NULL DEFAULT 'active',
  default_currency text NOT NULL DEFAULT 'USD',
  terms text,
  reputation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suppliers_actor_idx ON suppliers (actor_id);
CREATE INDEX suppliers_organization_idx ON suppliers (organization_id);

CREATE TABLE product_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gtin text,
  sku text,
  manufacturer_id text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  dimensions jsonb,
  packaging jsonb,
  unit_of_measure text NOT NULL DEFAULT 'each',
  tax_category text,
  compliance text[] NOT NULL DEFAULT '{}',
  lifecycle text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_base_gtin_idx ON product_base (gtin);
CREATE INDEX product_base_sku_idx ON product_base (sku);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_idx ON product_variants (product_id);

CREATE TABLE catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_organization_id uuid NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  visibility text NOT NULL DEFAULT 'private',
  source text NOT NULL DEFAULT 'native',
  source_of_truth text NOT NULL DEFAULT 'server',
  sync_ref text,
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalogs_owner_idx ON catalogs (owner_organization_id);

CREATE TABLE catalog_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL,
  product_id uuid NOT NULL,
  seller_organization_id uuid NOT NULL,
  orderable_unit text NOT NULL DEFAULT 'each',
  price_quantity integer NOT NULL DEFAULT 1,
  price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_qty integer NOT NULL DEFAULT 0,
  max_qty integer,
  order_increment integer NOT NULL DEFAULT 1,
  availability text,
  lead_time text,
  validity_from timestamptz,
  validity_to timestamptz,
  tax_included boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalog_offers_catalog_idx ON catalog_offers (catalog_id);
CREATE INDEX catalog_offers_product_idx ON catalog_offers (product_id);
CREATE INDEX catalog_offers_seller_idx ON catalog_offers (seller_organization_id);

CREATE TABLE buyer_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_offer_id uuid NOT NULL,
  buyer_organization_id uuid NOT NULL,
  price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  validity_from timestamptz,
  validity_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX buyer_agreements_offer_idx ON buyer_agreements (catalog_offer_id);
CREATE INDEX buyer_agreements_buyer_idx ON buyer_agreements (buyer_organization_id);

CREATE TABLE quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_organization_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  response_deadline timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_requests_buyer_idx ON quote_requests (buyer_organization_id);

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL,
  seller_organization_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  terms text,
  status text NOT NULL DEFAULT 'submitted',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quotes_request_idx ON quotes (quote_request_id);
CREATE INDEX quotes_seller_idx ON quotes (seller_organization_id);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  buyer_organization_id uuid NOT NULL,
  seller_organization_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending_approval',
  approved_by_actor_id uuid,
  payment_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_orders_buyer_idx ON purchase_orders (buyer_organization_id);
CREATE INDEX purchase_orders_seller_idx ON purchase_orders (seller_organization_id);
CREATE INDEX purchase_orders_quote_idx ON purchase_orders (quote_id);