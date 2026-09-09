-- 0019_model_providers.sql
-- Provider-agnostic model configuration. A provider is any
-- OpenAI-compatible endpoint (OpenAI, OpenRouter, self-hosted gateways...).
-- One credential may expose many models; models are discovered live from
-- GET <baseUrl>/models and can be enabled/disabled individually.

CREATE TABLE IF NOT EXISTS model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_actor_id uuid REFERENCES actors(id) ON DELETE CASCADE,
  owner_organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  credential_ref text NOT NULL,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('ok', 'error', 'unknown')),
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_providers_owner_actor_idx
  ON model_providers (owner_actor_id);
CREATE INDEX IF NOT EXISTS model_providers_owner_org_idx
  ON model_providers (owner_organization_id);

CREATE TABLE IF NOT EXISTS provider_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  discovered boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_models_provider_model_key UNIQUE (provider_id, model_id)
);

CREATE INDEX IF NOT EXISTS provider_models_provider_idx
  ON provider_models (provider_id);
