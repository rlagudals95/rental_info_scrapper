CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS rental;

SET search_path TO rental, public;

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  official_product_url TEXT NOT NULL,
  cash_price NUMERIC(14, 2),
  specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'discontinued')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, model_code)
);

CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON products (category_id, status);

CREATE INDEX IF NOT EXISTS idx_products_specifications_gin
  ON products USING GIN (specifications);

CREATE TABLE IF NOT EXISTS rental_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  management_type TEXT NOT NULL
    CHECK (management_type IN ('visit', 'self')),
  contract_term_months INTEGER NOT NULL CHECK (contract_term_months > 0),
  obligation_term_months INTEGER NOT NULL CHECK (obligation_term_months > 0),
  ownership_transfer_months INTEGER,
  base_monthly_fee NUMERIC(14, 2) NOT NULL,
  promo_monthly_fee NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2) NOT NULL,
  registration_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
  installation_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
  visit_cycle_months INTEGER,
  filter_cycle_months INTEGER,
  care_summary TEXT NOT NULL,
  official_card_discount_amount NUMERIC(14, 2),
  official_card_required_spend_amount NUMERIC(14, 2),
  official_card_summary TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_plans_product_active
  ON rental_plans (product_id, is_active);

CREATE TABLE IF NOT EXISTS contract_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_plan_id UUID NOT NULL UNIQUE REFERENCES rental_plans(id) ON DELETE CASCADE,
  early_termination_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  penalty_summary TEXT NOT NULL,
  pickup_fee NUMERIC(14, 2),
  ownership_end_type TEXT NOT NULL
    CHECK (ownership_end_type IN ('return', 'transfer', 'renewal_choice', 'unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL
    CHECK (channel_type IN ('official_mall', 'comparison_market', 'lead_market', 'dealer')),
  website_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rental_plan_id UUID NOT NULL REFERENCES rental_plans(id) ON DELETE CASCADE,
  offer_name TEXT NOT NULL,
  public_offer_url TEXT NOT NULL UNIQUE,
  public_monthly_fee NUMERIC(14, 2),
  non_card_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  support_pricing_model TEXT NOT NULL
    CHECK (support_pricing_model IN ('fixed_public', 'range_public', 'quote_required', 'hidden')),
  support_amount NUMERIC(14, 2),
  support_amount_min NUMERIC(14, 2),
  support_amount_max NUMERIC(14, 2),
  payout_timing TEXT NOT NULL
    CHECK (payout_timing IN ('same_day', 'after_install', 'after_confirmation', 'delayed', 'unknown')),
  payout_method TEXT NOT NULL
    CHECK (payout_method IN ('cash', 'giftcard', 'points', 'product', 'mixed', 'unknown')),
  install_day_payout BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_guarantee_type TEXT NOT NULL
    CHECK (benefit_guarantee_type IN ('platform', 'seller', 'none', 'unclear')),
  matching_status TEXT NOT NULL
    CHECK (matching_status IN ('unmatched', 'auto_matched', 'manually_matched', 'low_confidence')),
  matching_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'hidden', 'sold_out')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      support_pricing_model = 'fixed_public' AND
      support_amount IS NOT NULL AND
      support_amount_min IS NULL AND
      support_amount_max IS NULL
    ) OR (
      support_pricing_model = 'range_public' AND
      support_amount IS NULL AND
      support_amount_min IS NOT NULL AND
      support_amount_max IS NOT NULL
    ) OR (
      support_pricing_model IN ('quote_required', 'hidden') AND
      support_amount IS NULL AND
      support_amount_min IS NULL AND
      support_amount_max IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_channel_offers_product_review
  ON channel_offers (product_id, review_status, status);

CREATE INDEX IF NOT EXISTS idx_channel_offers_plan
  ON channel_offers (rental_plan_id);

CREATE INDEX IF NOT EXISTS idx_channel_offers_support_model
  ON channel_offers (support_pricing_model);

CREATE TABLE IF NOT EXISTS offer_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_offer_id UUID NOT NULL REFERENCES channel_offers(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL
    CHECK (benefit_type IN ('giftcard', 'product_gift', 'fee_waiver', 'first_month_free', 'bundle_discount', 'other')),
  value_model TEXT NOT NULL
    CHECK (value_model IN ('fixed', 'range', 'hidden')),
  amount NUMERIC(14, 2),
  amount_min NUMERIC(14, 2),
  amount_max NUMERIC(14, 2),
  description TEXT NOT NULL,
  conditions TEXT,
  payout_timing TEXT NOT NULL
    CHECK (payout_timing IN ('same_day', 'after_install', 'after_confirmation', 'delayed', 'unknown')),
  payout_method TEXT NOT NULL
    CHECK (payout_method IN ('cash', 'giftcard', 'points', 'product', 'mixed', 'unknown')),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('page', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      value_model = 'fixed' AND
      amount IS NOT NULL AND
      amount_min IS NULL AND
      amount_max IS NULL
    ) OR (
      value_model = 'range' AND
      amount IS NULL AND
      amount_min IS NOT NULL AND
      amount_max IS NOT NULL
    ) OR (
      value_model = 'hidden' AND
      amount IS NULL AND
      amount_min IS NULL AND
      amount_max IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_offer_benefits_offer_active
  ON offer_benefits (channel_offer_id, is_active);

CREATE TABLE IF NOT EXISTS plan_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_plan_id UUID NOT NULL REFERENCES rental_plans(id) ON DELETE CASCADE,
  snapshot_hash TEXT NOT NULL,
  base_monthly_fee NUMERIC(14, 2) NOT NULL,
  promo_monthly_fee NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (rental_plan_id, snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_plan_price_snapshots_plan_captured
  ON plan_price_snapshots (rental_plan_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS offer_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_offer_id UUID NOT NULL REFERENCES channel_offers(id) ON DELETE CASCADE,
  snapshot_hash TEXT NOT NULL,
  public_monthly_fee NUMERIC(14, 2),
  non_card_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  support_pricing_model TEXT NOT NULL
    CHECK (support_pricing_model IN ('fixed_public', 'range_public', 'quote_required', 'hidden')),
  support_amount NUMERIC(14, 2),
  support_amount_min NUMERIC(14, 2),
  support_amount_max NUMERIC(14, 2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (channel_offer_id, snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_offer_price_snapshots_offer_captured
  ON offer_price_snapshots (channel_offer_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS batch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('scheduled', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL
    CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
  channel_count INTEGER NOT NULL DEFAULT 0,
  success_channel_count INTEGER NOT NULL DEFAULT 0,
  failed_channel_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  latest_products_csv_path TEXT,
  latest_offers_csv_path TEXT,
  archived_products_csv_path TEXT,
  archived_offers_csv_path TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS crawl_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  crawler_key TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('official', 'channel')),
  source_priority INTEGER NOT NULL DEFAULT 100,
  crawl_frequency_minutes INTEGER NOT NULL DEFAULT 360 CHECK (crawl_frequency_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_sources_kind_priority
  ON crawl_sources (source_kind, source_priority, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crawl_sources_crawler_key
  ON crawl_sources (crawler_key);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_source_id UUID NOT NULL REFERENCES crawl_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL
    CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
  items_discovered INTEGER NOT NULL DEFAULT 0,
  items_upserted INTEGER NOT NULL DEFAULT 0,
  warnings_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

ALTER TABLE crawl_runs
  ADD COLUMN IF NOT EXISTS batch_run_id UUID REFERENCES batch_runs(id) ON DELETE SET NULL;

ALTER TABLE crawl_runs
  ADD COLUMN IF NOT EXISTS channel_slug TEXT;

ALTER TABLE crawl_runs
  ADD COLUMN IF NOT EXISTS items_failed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE crawl_runs
  ADD COLUMN IF NOT EXISTS drift_status TEXT NOT NULL DEFAULT 'ok';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crawl_runs_drift_status_check'
  ) THEN
    ALTER TABLE crawl_runs
      ADD CONSTRAINT crawl_runs_drift_status_check
      CHECK (drift_status IN ('ok', 'warning', 'critical', 'informational'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crawl_runs_source_started
  ON crawl_runs (crawl_source_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_batch_started
  ON crawl_runs (batch_run_id, started_at DESC);

CREATE TABLE IF NOT EXISTS current_crawled_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE RESTRICT,
  channel_slug TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  detail_url TEXT NOT NULL,
  thumbnail_url TEXT,
  feature_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  offer_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(8, 2),
  review_count INTEGER,
  order_count INTEGER,
  ranking_rank INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_slug, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_current_crawled_products_channel_model
  ON current_crawled_products (channel_slug, model_code);

CREATE TABLE IF NOT EXISTS current_crawled_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE RESTRICT,
  channel_slug TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  external_offer_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  product_detail_url TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  public_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  card_discount_amount NUMERIC(14, 2),
  has_affiliate_card BOOLEAN NOT NULL DEFAULT FALSE,
  primary_card_company TEXT,
  primary_card_name TEXT,
  card_companies JSONB NOT NULL DEFAULT '[]'::JSONB,
  card_names JSONB NOT NULL DEFAULT '[]'::JSONB,
  contract_term_months INTEGER,
  obligation_term_months INTEGER,
  ownership_transfer_months INTEGER,
  management_type TEXT
    CHECK (management_type IN ('visit', 'self')),
  maintenance_cycle_months INTEGER,
  maintenance_period_months INTEGER,
  commitment_period_months INTEGER,
  promo_duration_months INTEGER,
  post_promo_monthly_fee NUMERIC(14, 2),
  support_pricing_model TEXT NOT NULL
    CHECK (support_pricing_model IN ('fixed_public', 'range_public', 'quote_required', 'hidden')),
  support_amount NUMERIC(14, 2),
  support_amount_min NUMERIC(14, 2),
  support_amount_max NUMERIC(14, 2),
  rating NUMERIC(8, 2),
  review_count INTEGER,
  order_count INTEGER,
  ranking_rank INTEGER,
  feature_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_slug, external_offer_id)
);

CREATE INDEX IF NOT EXISTS idx_current_crawled_offers_channel_product
  ON current_crawled_offers (channel_slug, external_product_id);

CREATE INDEX IF NOT EXISTS idx_current_crawled_offers_channel_term
  ON current_crawled_offers (channel_slug, contract_term_months, management_type);

CREATE TABLE IF NOT EXISTS crawled_product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  channel_slug TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  detail_url TEXT NOT NULL,
  thumbnail_url TEXT,
  feature_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  offer_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(8, 2),
  review_count INTEGER,
  order_count INTEGER,
  ranking_rank INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crawl_run_id, channel_slug, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_crawled_product_snapshots_channel_fetched
  ON crawled_product_snapshots (channel_slug, fetched_at DESC);

CREATE TABLE IF NOT EXISTS crawled_offer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  channel_slug TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  external_offer_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  product_detail_url TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  public_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  card_discount_amount NUMERIC(14, 2),
  has_affiliate_card BOOLEAN NOT NULL DEFAULT FALSE,
  primary_card_company TEXT,
  primary_card_name TEXT,
  card_companies JSONB NOT NULL DEFAULT '[]'::JSONB,
  card_names JSONB NOT NULL DEFAULT '[]'::JSONB,
  contract_term_months INTEGER,
  obligation_term_months INTEGER,
  ownership_transfer_months INTEGER,
  management_type TEXT
    CHECK (management_type IN ('visit', 'self')),
  maintenance_cycle_months INTEGER,
  maintenance_period_months INTEGER,
  commitment_period_months INTEGER,
  promo_duration_months INTEGER,
  post_promo_monthly_fee NUMERIC(14, 2),
  support_pricing_model TEXT NOT NULL
    CHECK (support_pricing_model IN ('fixed_public', 'range_public', 'quote_required', 'hidden')),
  support_amount NUMERIC(14, 2),
  support_amount_min NUMERIC(14, 2),
  support_amount_max NUMERIC(14, 2),
  rating NUMERIC(8, 2),
  review_count INTEGER,
  order_count INTEGER,
  ranking_rank INTEGER,
  feature_tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crawl_run_id, channel_slug, external_offer_id)
);

CREATE INDEX IF NOT EXISTS idx_crawled_offer_snapshots_channel_fetched
  ON crawled_offer_snapshots (channel_slug, fetched_at DESC);

CREATE TABLE IF NOT EXISTS raw_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  source_url TEXT NOT NULL,
  document_kind TEXT NOT NULL
    CHECK (document_kind IN ('html', 'json', 'pdf', 'screenshot', 'api_response')),
  storage_path TEXT NOT NULL,
  checksum_sha256 TEXT,
  parsed_success BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_raw_documents_run_captured
  ON raw_documents (crawl_run_id, captured_at DESC);
