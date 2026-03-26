CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS rental;

SET search_path TO rental, public;

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_type TEXT NOT NULL DEFAULT 'supplier'
    CHECK (brand_type IN ('supplier', 'channel', 'card_issuer', 'mixed')),
  website_url TEXT,
  country_code CHAR(2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_code TEXT,
  supplier_product_code TEXT,
  launch_date DATE,
  cash_price NUMERIC(14, 2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'discontinued', 'prelaunch', 'hidden')),
  official_product_url TEXT,
  source_of_truth TEXT NOT NULL DEFAULT 'official',
  specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_products_brand_category
  ON products (brand_id, category_id);

CREATE INDEX IF NOT EXISTS idx_products_specifications_gin
  ON products
  USING GIN (specifications);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  variant_name TEXT,
  color_name TEXT,
  option_values JSONB NOT NULL DEFAULT '{}'::JSONB,
  dimensions JSONB NOT NULL DEFAULT '{}'::JSONB,
  energy_grade TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, sku)
);

CREATE TABLE IF NOT EXISTS rental_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  source_key TEXT,
  supplier_plan_code TEXT,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'rental'
    CHECK (plan_type IN ('rental', 'subscription', 'installment_subscription')),
  management_type TEXT NOT NULL DEFAULT 'unknown',
  care_level TEXT,
  contract_term_months INTEGER NOT NULL CHECK (contract_term_months > 0),
  obligation_term_months INTEGER CHECK (obligation_term_months >= 0),
  ownership_transfer_months INTEGER CHECK (ownership_transfer_months >= 0),
  installment_term_months INTEGER CHECK (installment_term_months >= 0),
  base_monthly_fee NUMERIC(14, 2),
  promo_monthly_fee NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2),
  registration_fee NUMERIC(14, 2),
  installation_fee NUMERIC(14, 2),
  deposit_amount NUMERIC(14, 2),
  prepayment_amount NUMERIC(14, 2),
  free_as_months INTEGER CHECK (free_as_months >= 0),
  is_official BOOLEAN NOT NULL DEFAULT TRUE,
  official_plan_url TEXT,
  price_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_rental_plans_product
  ON rental_plans (product_id, is_active);

CREATE TABLE IF NOT EXISTS plan_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_plan_id UUID NOT NULL REFERENCES rental_plans(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  currency_code CHAR(3) NOT NULL DEFAULT 'KRW',
  base_monthly_fee NUMERIC(14, 2),
  promo_monthly_fee NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2),
  registration_fee NUMERIC(14, 2),
  installation_fee NUMERIC(14, 2),
  deposit_amount NUMERIC(14, 2),
  prepayment_amount NUMERIC(14, 2),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_plan_price_snapshots_plan_captured
  ON plan_price_snapshots (rental_plan_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS care_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_plan_id UUID NOT NULL UNIQUE REFERENCES rental_plans(id) ON DELETE CASCADE,
  care_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (care_type IN ('visit', 'self', 'hybrid', 'unknown')),
  visit_cycle_months INTEGER CHECK (visit_cycle_months >= 0),
  filter_delivery_cycle_months INTEGER CHECK (filter_delivery_cycle_months >= 0),
  dismantle_cleaning_cycle_months INTEGER CHECK (dismantle_cleaning_cycle_months >= 0),
  free_filter_replacement BOOLEAN NOT NULL DEFAULT FALSE,
  app_support BOOLEAN NOT NULL DEFAULT FALSE,
  service_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS care_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_program_id UUID NOT NULL REFERENCES care_programs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  frequency_months INTEGER CHECK (frequency_months >= 0),
  included BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_service_items_program
  ON care_service_items (care_program_id);

CREATE TABLE IF NOT EXISTS contract_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_plan_id UUID NOT NULL UNIQUE REFERENCES rental_plans(id) ON DELETE CASCADE,
  early_termination_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  penalty_formula TEXT,
  discount_clawback_formula TEXT,
  pickup_fee NUMERIC(14, 2),
  transfer_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  reinstallation_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ownership_end_type TEXT
    CHECK (ownership_end_type IN ('return', 'transfer', 'renewal_choice', 'unknown')),
  reinstallation_notes TEXT,
  missed_payment_policy TEXT,
  loss_damage_policy TEXT,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL
    CHECK (channel_type IN ('official_mall', 'dealer', 'comparison_market', 'lead_market', 'affiliate', 'open_market')),
  website_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  seller_code TEXT,
  name TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  seller_url TEXT,
  consultation_phone TEXT,
  chat_url TEXT,
  rating NUMERIC(4, 2),
  review_count INTEGER NOT NULL DEFAULT 0,
  response_speed_score NUMERIC(5, 2),
  payout_reliability_score NUMERIC(5, 2),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sales_channel_id, seller_code)
);

CREATE INDEX IF NOT EXISTS idx_channel_sellers_channel
  ON channel_sellers (sales_channel_id, is_active);

CREATE TABLE IF NOT EXISTS channel_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  channel_seller_id UUID REFERENCES channel_sellers(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  rental_plan_id UUID REFERENCES rental_plans(id) ON DELETE SET NULL,
  offer_external_key TEXT,
  offer_name TEXT NOT NULL,
  public_offer_url TEXT NOT NULL,
  matching_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (matching_status IN ('unmatched', 'auto_matched', 'manually_matched', 'low_confidence')),
  quote_required BOOLEAN NOT NULL DEFAULT FALSE,
  consultation_required BOOLEAN NOT NULL DEFAULT FALSE,
  signup_mode TEXT NOT NULL DEFAULT 'consultation'
    CHECK (signup_mode IN ('self_signup', 'consultation', 'both')),
  support_disclosure_status TEXT NOT NULL DEFAULT 'hidden'
    CHECK (support_disclosure_status IN ('exact', 'range', 'hidden', 'quote_required', 'review_inferred')),
  public_monthly_fee NUMERIC(14, 2),
  non_card_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  expected_benefit_amount_min NUMERIC(14, 2),
  expected_benefit_amount_max NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2),
  payout_timing TEXT
    CHECK (payout_timing IN ('same_day', 'after_install', 'after_confirmation', 'delayed', 'unknown')),
  payout_method TEXT
    CHECK (payout_method IN ('cash', 'giftcard', 'points', 'product', 'mixed', 'unknown')),
  install_day_payout BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_guarantee_type TEXT
    CHECK (benefit_guarantee_type IN ('platform', 'seller', 'none', 'unclear')),
  benefit_transparency_score NUMERIC(5, 2),
  payout_reliability_score NUMERIC(5, 2),
  review_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'hidden', 'sold_out')),
  matching_confidence NUMERIC(5, 2),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sales_channel_id, offer_external_key),
  UNIQUE (public_offer_url)
);

CREATE INDEX IF NOT EXISTS idx_channel_offers_product
  ON channel_offers (product_id, status);

CREATE INDEX IF NOT EXISTS idx_channel_offers_plan
  ON channel_offers (rental_plan_id);

CREATE INDEX IF NOT EXISTS idx_channel_offers_channel
  ON channel_offers (sales_channel_id, channel_seller_id);

CREATE INDEX IF NOT EXISTS idx_channel_offers_quote
  ON channel_offers (quote_required, support_disclosure_status);

CREATE TABLE IF NOT EXISTS offer_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_offer_id UUID NOT NULL REFERENCES channel_offers(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  public_monthly_fee NUMERIC(14, 2),
  non_card_monthly_fee NUMERIC(14, 2),
  card_applied_monthly_fee NUMERIC(14, 2),
  expected_benefit_amount_min NUMERIC(14, 2),
  expected_benefit_amount_max NUMERIC(14, 2),
  total_contract_cost NUMERIC(14, 2),
  pricing_notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_offer_price_snapshots_offer_captured
  ON offer_price_snapshots (channel_offer_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS offer_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_offer_id UUID NOT NULL REFERENCES channel_offers(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL
    CHECK (benefit_type IN ('cash', 'giftcard', 'points', 'product_gift', 'fee_waiver', 'first_month_free', 'bundle_discount', 'other')),
  title TEXT,
  description TEXT,
  disclosure_status TEXT NOT NULL DEFAULT 'hidden'
    CHECK (disclosure_status IN ('exact', 'range', 'hidden', 'quote_required', 'review_inferred')),
  is_cash_equivalent BOOLEAN NOT NULL DEFAULT FALSE,
  amount NUMERIC(14, 2),
  amount_min NUMERIC(14, 2),
  amount_max NUMERIC(14, 2),
  currency_code CHAR(3) NOT NULL DEFAULT 'KRW',
  conditions TEXT,
  payout_timing TEXT
    CHECK (payout_timing IN ('same_day', 'after_install', 'after_confirmation', 'delayed', 'unknown')),
  payout_method TEXT
    CHECK (payout_method IN ('cash', 'giftcard', 'points', 'product', 'mixed', 'unknown')),
  source_type TEXT NOT NULL DEFAULT 'page'
    CHECK (source_type IN ('page', 'consultation', 'review', 'partner_feed', 'manual')),
  source_url TEXT,
  source_confidence NUMERIC(5, 2),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_benefits_offer
  ON offer_benefits (channel_offer_id, is_active);

CREATE TABLE IF NOT EXISTS card_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_code TEXT,
  landing_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issuer_name, card_name)
);

CREATE TABLE IF NOT EXISTS offer_card_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_program_id UUID NOT NULL REFERENCES card_programs(id) ON DELETE CASCADE,
  rental_plan_id UUID REFERENCES rental_plans(id) ON DELETE CASCADE,
  channel_offer_id UUID REFERENCES channel_offers(id) ON DELETE CASCADE,
  required_spend_amount NUMERIC(14, 2),
  monthly_discount_amount NUMERIC(14, 2),
  max_discount_months INTEGER CHECK (max_discount_months >= 0),
  conditions TEXT,
  source_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rental_plan_id IS NOT NULL OR channel_offer_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_offer_card_programs_offer
  ON offer_card_programs (channel_offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_card_programs_plan
  ON offer_card_programs (rental_plan_id);

CREATE TABLE IF NOT EXISTS seller_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  channel_seller_id UUID REFERENCES channel_sellers(id) ON DELETE SET NULL,
  channel_offer_id UUID REFERENCES channel_offers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  review_source_url TEXT,
  review_date DATE,
  headline TEXT,
  body TEXT,
  sentiment_score NUMERIC(5, 2),
  actual_monthly_fee NUMERIC(14, 2),
  actual_benefit_amount NUMERIC(14, 2),
  actual_benefit_paid BOOLEAN,
  payout_days INTEGER CHECK (payout_days >= 0),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_reviews_channel
  ON seller_reviews (sales_channel_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_seller_reviews_tags_gin
  ON seller_reviews
  USING GIN (tags);

CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  requested_by_hash TEXT,
  preferred_contract_term_months INTEGER CHECK (preferred_contract_term_months > 0),
  preferred_management_type TEXT,
  phone_bundle_expected BOOLEAN NOT NULL DEFAULT FALSE,
  card_usage_expected BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'quoted', 'expired', 'cancelled')),
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status
  ON quote_requests (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS quote_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  sales_channel_id UUID NOT NULL REFERENCES sales_channels(id) ON DELETE CASCADE,
  channel_seller_id UUID REFERENCES channel_sellers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  rental_plan_id UUID REFERENCES rental_plans(id) ON DELETE SET NULL,
  quoted_monthly_fee NUMERIC(14, 2),
  quoted_benefit_amount NUMERIC(14, 2),
  quoted_benefit_description TEXT,
  payout_timing TEXT
    CHECK (payout_timing IN ('same_day', 'after_install', 'after_confirmation', 'delayed', 'unknown')),
  valid_until TIMESTAMPTZ,
  response_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (response_source IN ('manual', 'partner_api', 'phone', 'chat', 'email', 'scraped')),
  confidence_score NUMERIC(5, 2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_responses_request
  ON quote_responses (quote_request_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS crawl_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('official', 'channel', 'card', 'review', 'quote')),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  crawler_key TEXT NOT NULL,
  crawl_frequency_minutes INTEGER NOT NULL DEFAULT 360 CHECK (crawl_frequency_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_sources_kind
  ON crawl_sources (source_kind, is_active);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_source_id UUID NOT NULL REFERENCES crawl_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
  http_status INTEGER,
  items_discovered INTEGER NOT NULL DEFAULT 0,
  items_upserted INTEGER NOT NULL DEFAULT 0,
  warnings_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_source_started
  ON crawl_runs (crawl_source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS raw_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  source_url TEXT NOT NULL,
  document_kind TEXT NOT NULL
    CHECK (document_kind IN ('html', 'json', 'screenshot', 'pdf', 'api_response')),
  storage_path TEXT NOT NULL,
  checksum_sha256 TEXT,
  parsed_success BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_raw_documents_run
  ON raw_documents (crawl_run_id, captured_at DESC);
