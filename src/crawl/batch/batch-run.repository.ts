import type { Client } from 'pg';

import { withPgClient, withTransaction } from '../../db/pg-client';
import type {
  FinishBatchRunInput,
  FinishChannelRunInput,
  BatchRunRecord,
  ChannelRunRecord,
  ChannelMetricsHistory,
  DailyBatchRepository,
} from './daily-batch-runner';
import type {
  BatchTriggerType,
  BatchRunStatus,
  ChannelCatalogData,
  ChannelQualityMetrics,
  ChannelSlug,
  CurrentCrawledOfferRow,
  CurrentCrawledProductRow,
  DriftDetectionResult,
} from './batch.types';

interface ChannelSourceConfig {
  baseUrl: string;
  websiteUrl: string;
  salesChannelName: string;
  crawlSourceName: string;
  channelType: 'comparison_market' | 'lead_market' | 'dealer';
}

type QueryableClient = Pick<Client, 'query'>;

const CHANNEL_SOURCE_CONFIG: Record<ChannelSlug, ChannelSourceConfig> = {
  ajd: {
    baseUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
    websiteUrl: 'https://www.ajd.co.kr',
    salesChannelName: '아정당',
    crawlSourceName: 'AJD Water Purifier Ranking',
    channelType: 'comparison_market',
  },
  miso: {
    baseUrl: 'https://miso.kr/booking/rental/water_purifier',
    websiteUrl: 'https://miso.kr',
    salesChannelName: '미소',
    crawlSourceName: 'Miso Water Purifier Directory',
    channelType: 'lead_market',
  },
  rentre: {
    baseUrl: 'https://rentre.kr/water-purifier',
    websiteUrl: 'https://rentre.kr',
    salesChannelName: '렌트리',
    crawlSourceName: 'Rentre Water Purifier Listing',
    channelType: 'comparison_market',
  },
};

function toIsoString(value: string): string {
  return new Date(value).toISOString();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseMetrics(value: unknown): ChannelMetricsHistory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const metrics = value as Record<string, unknown>;

  return {
    offersCount: Number(metrics.offersCount ?? 0),
    contractTermNullRate: Number(metrics.contractTermNullRate ?? 0),
    managementTypeNullRate: Number(metrics.managementTypeNullRate ?? 0),
    primaryCardCompanyNullRate: Number(metrics.primaryCardCompanyNullRate ?? 0),
    affiliateCardOfferCount: Number(metrics.affiliateCardOfferCount ?? 0),
    affiliateCardCompanyFilledCount: Number(metrics.affiliateCardCompanyFilledCount ?? 0),
    affiliateCardNameFilledCount: Number(metrics.affiliateCardNameFilledCount ?? 0),
  };
}

async function ensureSalesChannel(client: QueryableClient, channel: ChannelSlug): Promise<string> {
  const config = CHANNEL_SOURCE_CONFIG[channel];
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO rental.sales_channels (
        slug,
        name,
        channel_type,
        website_url
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        channel_type = EXCLUDED.channel_type,
        website_url = EXCLUDED.website_url,
        updated_at = NOW()
      RETURNING id
    `,
    [channel, config.salesChannelName, config.channelType, config.websiteUrl],
  );

  return result.rows[0]?.id ?? '';
}

async function ensureCrawlSource(client: QueryableClient, channel: ChannelSlug): Promise<string> {
  const salesChannelId = await ensureSalesChannel(client, channel);
  const config = CHANNEL_SOURCE_CONFIG[channel];
  const crawlerKey = `${channel}-water-purifier`;
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO rental.crawl_sources (
        sales_channel_id,
        name,
        base_url,
        crawler_key,
        source_kind
      )
      VALUES ($1, $2, $3, $4, 'channel')
      ON CONFLICT (crawler_key) DO UPDATE
      SET
        sales_channel_id = EXCLUDED.sales_channel_id,
        name = EXCLUDED.name,
        base_url = EXCLUDED.base_url,
        updated_at = NOW()
      RETURNING id
    `,
    [salesChannelId, config.crawlSourceName, config.baseUrl, crawlerKey],
  );

  return result.rows[0]?.id ?? '';
}

async function insertProductRows(
  client: QueryableClient,
  tableName: 'current_crawled_products' | 'crawled_product_snapshots',
  crawlRunId: string,
  channel: ChannelSlug,
  rows: readonly CurrentCrawledProductRow[],
): Promise<void> {
  const isCurrentTable = tableName === 'current_crawled_products';

  for (const row of rows) {
    await client.query(
      `
        INSERT INTO rental.${tableName} (
          crawl_run_id,
          channel_slug,
          fetched_at,
          source_url,
          external_product_id,
          brand_name,
          product_name,
          model_code,
          detail_url,
          thumbnail_url,
          feature_tags,
          offer_count,
          rating,
          review_count,
          order_count,
          ranking_rank,
          metadata
          ${isCurrentTable ? ', updated_at' : ''}
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17::jsonb
          ${isCurrentTable ? ', NOW()' : ''}
        )
        ${isCurrentTable
          ? `
            ON CONFLICT (channel_slug, external_product_id) DO UPDATE
            SET
              crawl_run_id = EXCLUDED.crawl_run_id,
              fetched_at = EXCLUDED.fetched_at,
              source_url = EXCLUDED.source_url,
              brand_name = EXCLUDED.brand_name,
              product_name = EXCLUDED.product_name,
              model_code = EXCLUDED.model_code,
              detail_url = EXCLUDED.detail_url,
              thumbnail_url = EXCLUDED.thumbnail_url,
              feature_tags = EXCLUDED.feature_tags,
              offer_count = EXCLUDED.offer_count,
              rating = EXCLUDED.rating,
              review_count = EXCLUDED.review_count,
              order_count = EXCLUDED.order_count,
              ranking_rank = EXCLUDED.ranking_rank,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
          `
          : ''}
      `,
      [
        crawlRunId,
        channel,
        toIsoString(row.fetchedAt),
        row.sourceUrl,
        row.externalProductId,
        row.brandName,
        row.productName,
        row.modelCode,
        row.detailUrl,
        row.thumbnailUrl,
        JSON.stringify(row.featureTags),
        row.offerCount,
        row.rating,
        row.reviewCount,
        row.orderCount,
        row.rankingRank,
        JSON.stringify(row.metadata),
      ],
    );
  }
}

async function insertOfferRows(
  client: QueryableClient,
  tableName: 'current_crawled_offers' | 'crawled_offer_snapshots',
  crawlRunId: string,
  channel: ChannelSlug,
  rows: readonly CurrentCrawledOfferRow[],
): Promise<void> {
  const isCurrentTable = tableName === 'current_crawled_offers';

  for (const row of rows) {
    await client.query(
      `
        INSERT INTO rental.${tableName} (
          crawl_run_id,
          channel_slug,
          fetched_at,
          source_url,
          external_product_id,
          external_offer_id,
          brand_name,
          product_name,
          model_code,
          product_detail_url,
          offer_url,
          public_monthly_fee,
          card_applied_monthly_fee,
          card_discount_amount,
          has_affiliate_card,
          primary_card_company,
          primary_card_name,
          card_companies,
          card_names,
          contract_term_months,
          obligation_term_months,
          ownership_transfer_months,
          management_type,
          maintenance_cycle_months,
          maintenance_period_months,
          commitment_period_months,
          promo_duration_months,
          post_promo_monthly_fee,
          support_pricing_model,
          support_amount,
          support_amount_min,
          support_amount_max,
          rating,
          review_count,
          order_count,
          ranking_rank,
          feature_tags,
          metadata
          ${isCurrentTable ? ', updated_at' : ''}
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
          $37::jsonb, $38::jsonb
          ${isCurrentTable ? ', NOW()' : ''}
        )
        ${isCurrentTable
          ? `
            ON CONFLICT (channel_slug, external_offer_id) DO UPDATE
            SET
              crawl_run_id = EXCLUDED.crawl_run_id,
              fetched_at = EXCLUDED.fetched_at,
              source_url = EXCLUDED.source_url,
              external_product_id = EXCLUDED.external_product_id,
              brand_name = EXCLUDED.brand_name,
              product_name = EXCLUDED.product_name,
              model_code = EXCLUDED.model_code,
              product_detail_url = EXCLUDED.product_detail_url,
              offer_url = EXCLUDED.offer_url,
              public_monthly_fee = EXCLUDED.public_monthly_fee,
              card_applied_monthly_fee = EXCLUDED.card_applied_monthly_fee,
              card_discount_amount = EXCLUDED.card_discount_amount,
              has_affiliate_card = EXCLUDED.has_affiliate_card,
              primary_card_company = EXCLUDED.primary_card_company,
              primary_card_name = EXCLUDED.primary_card_name,
              card_companies = EXCLUDED.card_companies,
              card_names = EXCLUDED.card_names,
              contract_term_months = EXCLUDED.contract_term_months,
              obligation_term_months = EXCLUDED.obligation_term_months,
              ownership_transfer_months = EXCLUDED.ownership_transfer_months,
              management_type = EXCLUDED.management_type,
              maintenance_cycle_months = EXCLUDED.maintenance_cycle_months,
              maintenance_period_months = EXCLUDED.maintenance_period_months,
              commitment_period_months = EXCLUDED.commitment_period_months,
              promo_duration_months = EXCLUDED.promo_duration_months,
              post_promo_monthly_fee = EXCLUDED.post_promo_monthly_fee,
              support_pricing_model = EXCLUDED.support_pricing_model,
              support_amount = EXCLUDED.support_amount,
              support_amount_min = EXCLUDED.support_amount_min,
              support_amount_max = EXCLUDED.support_amount_max,
              rating = EXCLUDED.rating,
              review_count = EXCLUDED.review_count,
              order_count = EXCLUDED.order_count,
              ranking_rank = EXCLUDED.ranking_rank,
              feature_tags = EXCLUDED.feature_tags,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
          `
          : ''}
      `,
      [
        crawlRunId,
        channel,
        toIsoString(row.fetchedAt),
        row.sourceUrl,
        row.externalProductId,
        row.externalOfferId,
        row.brandName,
        row.productName,
        row.modelCode,
        row.productDetailUrl,
        row.offerUrl,
        row.publicMonthlyFee,
        row.cardAppliedMonthlyFee,
        row.cardDiscountAmount,
        row.hasAffiliateCard,
        row.primaryCardCompany,
        row.primaryCardName,
        JSON.stringify(row.cardCompanies),
        JSON.stringify(row.cardNames),
        row.contractTermMonths,
        row.obligationTermMonths,
        row.ownershipTransferMonths,
        row.managementType,
        row.maintenanceCycleMonths,
        row.maintenancePeriodMonths,
        row.commitmentPeriodMonths,
        row.promoDurationMonths,
        row.postPromoMonthlyFee,
        row.supportPricingModel,
        row.supportAmount,
        row.supportAmountMin,
        row.supportAmountMax,
        row.rating,
        row.reviewCount,
        row.orderCount,
        row.rankingRank,
        JSON.stringify(row.featureTags),
        JSON.stringify(row.metadata),
      ],
    );
  }
}

function mapProductRow(row: Record<string, unknown>): CurrentCrawledProductRow {
  return {
    channel: row.channel_slug as ChannelSlug,
    fetchedAt: toIsoString(String(row.fetched_at)),
    sourceUrl: String(row.source_url),
    externalProductId: String(row.external_product_id),
    brandName: String(row.brand_name),
    productName: String(row.product_name),
    modelCode: String(row.model_code),
    detailUrl: String(row.detail_url),
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    featureTags: Array.isArray(row.feature_tags) ? (row.feature_tags as string[]) : [],
    offerCount: Number(row.offer_count ?? 0),
    rating: toNumberOrNull(row.rating),
    reviewCount: row.review_count === null || row.review_count === undefined ? null : Number(row.review_count),
    orderCount: row.order_count === null || row.order_count === undefined ? null : Number(row.order_count),
    rankingRank:
      row.ranking_rank === null || row.ranking_rank === undefined ? null : Number(row.ranking_rank),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapOfferRow(row: Record<string, unknown>): CurrentCrawledOfferRow {
  return {
    channel: row.channel_slug as ChannelSlug,
    fetchedAt: toIsoString(String(row.fetched_at)),
    sourceUrl: String(row.source_url),
    externalProductId: String(row.external_product_id),
    externalOfferId: String(row.external_offer_id),
    brandName: String(row.brand_name),
    productName: String(row.product_name),
    modelCode: String(row.model_code),
    productDetailUrl: String(row.product_detail_url),
    offerUrl: String(row.offer_url),
    publicMonthlyFee: toNumberOrNull(row.public_monthly_fee),
    cardAppliedMonthlyFee: toNumberOrNull(row.card_applied_monthly_fee),
    cardDiscountAmount: toNumberOrNull(row.card_discount_amount),
    hasAffiliateCard: Boolean(row.has_affiliate_card),
    primaryCardCompany: row.primary_card_company ? String(row.primary_card_company) : null,
    primaryCardName: row.primary_card_name ? String(row.primary_card_name) : null,
    cardCompanies: Array.isArray(row.card_companies) ? (row.card_companies as string[]) : [],
    cardNames: Array.isArray(row.card_names) ? (row.card_names as string[]) : [],
    contractTermMonths:
      row.contract_term_months === null || row.contract_term_months === undefined
        ? null
        : Number(row.contract_term_months),
    obligationTermMonths:
      row.obligation_term_months === null || row.obligation_term_months === undefined
        ? null
        : Number(row.obligation_term_months),
    ownershipTransferMonths:
      row.ownership_transfer_months === null || row.ownership_transfer_months === undefined
        ? null
        : Number(row.ownership_transfer_months),
    managementType: (row.management_type as CurrentCrawledOfferRow['managementType']) ?? null,
    maintenanceCycleMonths:
      row.maintenance_cycle_months === null || row.maintenance_cycle_months === undefined
        ? null
        : Number(row.maintenance_cycle_months),
    maintenancePeriodMonths:
      row.maintenance_period_months === null || row.maintenance_period_months === undefined
        ? null
        : Number(row.maintenance_period_months),
    commitmentPeriodMonths:
      row.commitment_period_months === null || row.commitment_period_months === undefined
        ? null
        : Number(row.commitment_period_months),
    promoDurationMonths:
      row.promo_duration_months === null || row.promo_duration_months === undefined
        ? null
        : Number(row.promo_duration_months),
    postPromoMonthlyFee: toNumberOrNull(row.post_promo_monthly_fee),
    supportPricingModel: row.support_pricing_model as CurrentCrawledOfferRow['supportPricingModel'],
    supportAmount: toNumberOrNull(row.support_amount),
    supportAmountMin: toNumberOrNull(row.support_amount_min),
    supportAmountMax: toNumberOrNull(row.support_amount_max),
    rating: toNumberOrNull(row.rating),
    reviewCount: row.review_count === null || row.review_count === undefined ? null : Number(row.review_count),
    orderCount: row.order_count === null || row.order_count === undefined ? null : Number(row.order_count),
    rankingRank:
      row.ranking_rank === null || row.ranking_rank === undefined ? null : Number(row.ranking_rank),
    featureTags: Array.isArray(row.feature_tags) ? (row.feature_tags as string[]) : [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export class PgDailyBatchRepository implements DailyBatchRepository {
  async createBatchRun(triggerType: BatchTriggerType = 'manual'): Promise<BatchRunRecord> {
    return withPgClient(async (client) => {
      const result = await client.query<{
        id: string;
        trigger_type: BatchTriggerType;
        started_at: string;
        finished_at: string | null;
        status: BatchRunStatus;
      }>(
        `
          INSERT INTO rental.batch_runs (trigger_type, status)
          VALUES ($1, 'running')
          RETURNING id, trigger_type, started_at, finished_at, status
        `,
        [triggerType],
      );

      const row = result.rows[0];
      return {
        id: row.id,
        triggerType: row.trigger_type,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
      };
    });
  }

  async createChannelRun(channel: ChannelSlug, batchRunId?: string): Promise<ChannelRunRecord> {
    return withPgClient(async (client) => {
      const crawlSourceId = await ensureCrawlSource(client, channel);
      const result = await client.query<{
        id: string;
        batch_run_id: string;
        channel_slug: ChannelSlug;
        started_at: string;
        finished_at: string | null;
        status: BatchRunStatus;
      }>(
        `
          INSERT INTO rental.crawl_runs (
            crawl_source_id,
            batch_run_id,
            channel_slug,
            status
          )
          VALUES ($1, $2, $3, 'running')
          RETURNING id, batch_run_id, channel_slug, started_at, finished_at, status
        `,
        [crawlSourceId, batchRunId ?? null, channel],
      );
      const row = result.rows[0];

      return {
        id: row.id,
        batchRunId: row.batch_run_id,
        channel: row.channel_slug,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
      };
    });
  }

  async getPreviousChannelMetrics(channel: ChannelSlug): Promise<ChannelMetricsHistory | null> {
    return withPgClient(async (client) => {
      const result = await client.query<{ metrics: unknown }>(
        `
          SELECT metadata->'metrics' AS metrics
          FROM rental.crawl_runs
          WHERE channel_slug = $1
            AND status IN ('success', 'partial_success')
            AND metadata ? 'metrics'
          ORDER BY started_at DESC
          LIMIT 1
        `,
        [channel],
      );

      return parseMetrics(result.rows[0]?.metrics ?? null);
    });
  }

  async writeChannelSnapshots(
    channel: ChannelSlug,
    crawlRunId?: string,
    catalog?: ChannelCatalogData,
    _metrics?: ChannelQualityMetrics,
    _drift?: DriftDetectionResult,
  ): Promise<void> {
    if (!crawlRunId || !catalog) {
      return;
    }

    await withPgClient((client) =>
      withTransaction(client, async () => {
        await insertProductRows(client, 'crawled_product_snapshots', crawlRunId, channel, catalog.products);
        await insertOfferRows(client, 'crawled_offer_snapshots', crawlRunId, channel, catalog.offers);
      }),
    );
  }

  async replaceCurrentChannelData(
    channel: ChannelSlug,
    crawlRunId?: string,
    catalog?: ChannelCatalogData,
  ): Promise<void> {
    if (!crawlRunId || !catalog) {
      return;
    }

    await withPgClient((client) =>
      withTransaction(client, async () => {
        await client.query(`DELETE FROM rental.current_crawled_offers WHERE channel_slug = $1`, [channel]);
        await client.query(`DELETE FROM rental.current_crawled_products WHERE channel_slug = $1`, [channel]);

        await insertProductRows(client, 'current_crawled_products', crawlRunId, channel, catalog.products);
        await insertOfferRows(client, 'current_crawled_offers', crawlRunId, channel, catalog.offers);
      }),
    );
  }

  async finishChannelRun(
    channel: ChannelSlug,
    status: BatchRunStatus,
    input?: FinishChannelRunInput,
  ): Promise<void> {
    await withPgClient(async (client) => {
      await client.query(
        `
          UPDATE rental.crawl_runs
          SET
            status = $2,
            finished_at = NOW(),
            items_discovered = COALESCE($3, items_discovered),
            items_upserted = COALESCE($4, items_upserted),
            items_failed = COALESCE($5, items_failed),
            warnings_count = $6,
            error_message = $7,
            drift_status = $8,
            metadata = $9::jsonb
          WHERE id = (
            SELECT id
            FROM rental.crawl_runs
            WHERE channel_slug = $1
            ORDER BY started_at DESC
            LIMIT 1
          )
        `,
        [
          channel,
          status,
          input?.itemsDiscovered ?? null,
          input?.itemsUpserted ?? null,
          input?.itemsFailed ?? null,
          input?.drift?.warnings.length ?? 0,
          input?.errorMessage ?? null,
          input?.drift?.status ?? 'ok',
          JSON.stringify({
            metrics: input?.metrics ?? null,
            drift: input?.drift ?? null,
          }),
        ],
      );
    });
  }

  async listCurrentProducts(): Promise<CurrentCrawledProductRow[]> {
    return withPgClient(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM rental.current_crawled_products
          ORDER BY channel_slug ASC, ranking_rank ASC NULLS LAST, brand_name ASC, model_code ASC
        `,
      );

      return result.rows.map((row) => mapProductRow(row));
    });
  }

  async listCurrentOffers(): Promise<CurrentCrawledOfferRow[]> {
    return withPgClient(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `
          SELECT *
          FROM rental.current_crawled_offers
          ORDER BY channel_slug ASC, ranking_rank ASC NULLS LAST, brand_name ASC, model_code ASC
        `,
      );

      return result.rows.map((row) => mapOfferRow(row));
    });
  }

  async finishBatchRun(status: BatchRunStatus, input?: FinishBatchRunInput): Promise<void> {
    await withPgClient(async (client) => {
      const summary = (input?.summary ?? {}) as Record<string, unknown>;

      await client.query(
        `
          UPDATE rental.batch_runs
          SET
            status = $1,
            finished_at = NOW(),
            channel_count = COALESCE($2, channel_count),
            success_channel_count = COALESCE($3, success_channel_count),
            failed_channel_count = COALESCE($4, failed_channel_count),
            warning_count = COALESCE($5, warning_count),
            latest_products_csv_path = $6,
            latest_offers_csv_path = $7,
            archived_products_csv_path = $8,
            archived_offers_csv_path = $9,
            summary_json = $10::jsonb
          WHERE id = (
            SELECT id
            FROM rental.batch_runs
            ORDER BY started_at DESC
            LIMIT 1
          )
        `,
        [
          status,
          summary.totalChannelCount ?? null,
          summary.successChannelCount ?? null,
          summary.failedChannelCount ?? null,
          summary.warningChannelCount ?? null,
          input?.latestProductsCsvPath ?? null,
          input?.latestOffersCsvPath ?? null,
          input?.archivedProductsCsvPath ?? null,
          input?.archivedOffersCsvPath ?? null,
          JSON.stringify(summary),
        ],
      );
    });
  }
}
