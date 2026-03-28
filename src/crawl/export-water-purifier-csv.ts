import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AllWaterPurifierCrawlResult, crawlAllWaterPurifierCatalogs } from './all-water-purifier.crawler';

type FetchLike = typeof fetch;
type CsvCellValue = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvCellValue>;

const PRODUCT_CSV_COLUMNS = [
  'channel',
  'fetched_at',
  'source_url',
  'external_product_id',
  'brand_name',
  'product_name',
  'model_code',
  'detail_url',
  'thumbnail_url',
  'feature_tags_json',
  'offer_count',
  'rating',
  'review_count',
  'order_count',
  'ranking_rank',
  'metadata_json',
] as const;

const OFFER_CSV_COLUMNS = [
  'channel',
  'fetched_at',
  'source_url',
  'external_product_id',
  'external_offer_id',
  'brand_name',
  'product_name',
  'model_code',
  'product_detail_url',
  'offer_url',
  'public_monthly_fee',
  'card_applied_monthly_fee',
  'card_discount_amount',
  'has_affiliate_card',
  'primary_card_company',
  'primary_card_name',
  'card_companies_json',
  'card_names_json',
  'contract_term_months',
  'obligation_term_months',
  'ownership_transfer_months',
  'management_type',
  'maintenance_cycle_months',
  'maintenance_period_months',
  'commitment_period_months',
  'promo_duration_months',
  'post_promo_monthly_fee',
  'support_pricing_model',
  'support_amount',
  'support_amount_min',
  'support_amount_max',
  'rating',
  'review_count',
  'order_count',
  'ranking_rank',
  'feature_tags_json',
  'metadata_json',
] as const;

type ProductCsvRow = Record<(typeof PRODUCT_CSV_COLUMNS)[number], CsvCellValue>;
type OfferCsvRow = Record<(typeof OFFER_CSV_COLUMNS)[number], CsvCellValue>;

export interface WaterPurifierCsvExportResult {
  outputDir: string;
  latestProductsCsvPath: string;
  latestOffersCsvPath: string;
  timestampedProductsCsvPath: string;
  timestampedOffersCsvPath: string;
  summary: AllWaterPurifierCrawlResult['summary'];
}

function toJsonCell(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function pickPrimaryListValue(values: readonly string[] | undefined): string | null {
  if (!values || values.length === 0) {
    return null;
  }

  return values[0] ?? null;
}

function sanitizeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function escapeCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function renderCsv(rows: readonly CsvRow[], columns: readonly string[]): string {
  const headerLine = columns.join(',');
  const bodyLines = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(','));

  return [headerLine, ...bodyLines].join('\n');
}

export function buildWaterPurifierProductCsvRows(
  result: AllWaterPurifierCrawlResult,
): ProductCsvRow[] {
  const rows: ProductCsvRow[] = [];

  result.channels.ajd.products.forEach((product) => {
    rows.push({
      channel: 'ajd',
      fetched_at: result.channels.ajd.fetchedAt,
      source_url: result.channels.ajd.sourceUrl,
      external_product_id: product.externalProductId,
      brand_name: product.brandName,
      product_name: product.productName,
      model_code: product.modelCode,
      detail_url: product.detailUrl,
      thumbnail_url: product.thumbnailUrl,
      feature_tags_json: toJsonCell(product.featureTags),
      offer_count: product.offers.length,
      rating: null,
      review_count: product.metadata.reviewCount,
      order_count: null,
      ranking_rank: product.rankingRank,
      metadata_json: toJsonCell(product.metadata),
    });
  });

  result.channels.miso.products.forEach((product) => {
    rows.push({
      channel: 'miso',
      fetched_at: result.channels.miso.fetchedAt,
      source_url: result.channels.miso.sourceUrl,
      external_product_id: product.externalProductId,
      brand_name: product.brandName,
      product_name: product.productName,
      model_code: product.modelCode,
      detail_url: product.detailUrl,
      thumbnail_url: product.thumbnailUrl,
      feature_tags_json: toJsonCell(product.featureTags),
      offer_count: product.offers.length,
      rating: null,
      review_count: null,
      order_count: null,
      ranking_rank: product.metadata.listingRank,
      metadata_json: toJsonCell(product.metadata),
    });
  });

  result.channels.rentre.products.forEach((product) => {
    rows.push({
      channel: 'rentre',
      fetched_at: result.channels.rentre.fetchedAt,
      source_url: result.channels.rentre.sourceUrl,
      external_product_id: product.externalProductId,
      brand_name: product.brandName,
      product_name: product.productName,
      model_code: product.modelCode,
      detail_url: product.detailUrl,
      thumbnail_url: product.thumbnailUrl,
      feature_tags_json: toJsonCell(product.featureTags),
      offer_count: product.offers.length,
      rating: product.metadata.rating,
      review_count: product.metadata.reviewCount,
      order_count: product.metadata.orderCount,
      ranking_rank: null,
      metadata_json: toJsonCell(product.metadata),
    });
  });

  return rows;
}

export function buildWaterPurifierOfferCsvRows(result: AllWaterPurifierCrawlResult): OfferCsvRow[] {
  const rows: OfferCsvRow[] = [];

  result.channels.ajd.products.forEach((product) => {
    product.offers.forEach((offer) => {
      rows.push({
        channel: 'ajd',
        fetched_at: result.channels.ajd.fetchedAt,
        source_url: result.channels.ajd.sourceUrl,
        external_product_id: product.externalProductId,
        external_offer_id: offer.externalOfferId,
        brand_name: product.brandName,
        product_name: product.productName,
        model_code: product.modelCode,
        product_detail_url: product.detailUrl,
        offer_url: offer.publicOfferUrl,
        public_monthly_fee: offer.publicMonthlyFee,
        card_applied_monthly_fee: offer.cardAppliedMonthlyFee,
        card_discount_amount: offer.metadata.cardDiscountAmount ?? null,
        has_affiliate_card:
          typeof offer.metadata.cardDiscountAmount === 'number' &&
          Number.isFinite(offer.metadata.cardDiscountAmount),
        primary_card_company: pickPrimaryListValue(offer.metadata.cardCompanies),
        primary_card_name: pickPrimaryListValue(offer.metadata.cardNames),
        card_companies_json: toJsonCell(offer.metadata.cardCompanies ?? []),
        card_names_json: toJsonCell(offer.metadata.cardNames ?? []),
        contract_term_months: offer.contractTermMonths,
        obligation_term_months: null,
        ownership_transfer_months: null,
        management_type: offer.managementType,
        maintenance_cycle_months: null,
        maintenance_period_months: null,
        commitment_period_months: null,
        promo_duration_months: null,
        post_promo_monthly_fee: null,
        support_pricing_model: offer.supportPricingModel,
        support_amount: offer.supportAmount,
        support_amount_min: offer.supportAmountMin,
        support_amount_max: offer.supportAmountMax,
        rating: null,
        review_count: product.metadata.reviewCount,
        order_count: null,
        ranking_rank: product.rankingRank,
        feature_tags_json: toJsonCell(product.featureTags),
        metadata_json: toJsonCell({
          productMetadata: product.metadata,
          offerMetadata: offer.metadata,
        }),
      });
    });
  });

  result.channels.miso.products.forEach((product) => {
    product.offers.forEach((offer) => {
      rows.push({
        channel: 'miso',
        fetched_at: result.channels.miso.fetchedAt,
        source_url: result.channels.miso.sourceUrl,
        external_product_id: product.externalProductId,
        external_offer_id: offer.externalOfferId,
        brand_name: product.brandName,
        product_name: product.productName,
        model_code: product.modelCode,
        product_detail_url: product.detailUrl,
        offer_url: offer.publicOfferUrl,
        public_monthly_fee: offer.publicMonthlyFee,
        card_applied_monthly_fee: offer.cardAppliedMonthlyFee,
        card_discount_amount: offer.cardDiscountAmount,
        has_affiliate_card: offer.cardDiscountAmount !== null,
        primary_card_company: null,
        primary_card_name: null,
        card_companies_json: toJsonCell([]),
        card_names_json: toJsonCell([]),
        contract_term_months: offer.contractTermMonths,
        obligation_term_months: offer.metadata.commitmentPeriodMonths,
        ownership_transfer_months: null,
        management_type: offer.managementType,
        maintenance_cycle_months: offer.metadata.maintenancePeriodMonths,
        maintenance_period_months: offer.metadata.maintenancePeriodMonths,
        commitment_period_months: offer.metadata.commitmentPeriodMonths,
        promo_duration_months: null,
        post_promo_monthly_fee: null,
        support_pricing_model: offer.supportPricingModel,
        support_amount: offer.supportAmount,
        support_amount_min: offer.supportAmountMin,
        support_amount_max: offer.supportAmountMax,
        rating: null,
        review_count: null,
        order_count: null,
        ranking_rank: product.metadata.listingRank,
        feature_tags_json: toJsonCell(product.featureTags),
        metadata_json: toJsonCell({
          productMetadata: product.metadata,
          offerMetadata: offer.metadata,
        }),
      });
    });
  });

  result.channels.rentre.products.forEach((product) => {
    product.offers.forEach((offer) => {
      rows.push({
        channel: 'rentre',
        fetched_at: result.channels.rentre.fetchedAt,
        source_url: result.channels.rentre.sourceUrl,
        external_product_id: product.externalProductId,
        external_offer_id: offer.externalOfferId,
        brand_name: product.brandName,
        product_name: product.productName,
        model_code: product.modelCode,
        product_detail_url: product.detailUrl,
        offer_url: offer.publicOfferUrl,
        public_monthly_fee: offer.publicMonthlyFee,
        card_applied_monthly_fee: offer.cardAppliedMonthlyFee,
        card_discount_amount: offer.metadata.affiliateCardDiscountAmount,
        has_affiliate_card: offer.metadata.hasAffiliateCard,
        primary_card_company: pickPrimaryListValue(offer.metadata.cardCompanies),
        primary_card_name: pickPrimaryListValue(offer.metadata.cardNames),
        card_companies_json: toJsonCell(offer.metadata.cardCompanies),
        card_names_json: toJsonCell(offer.metadata.cardNames),
        contract_term_months: offer.contractTermMonths,
        obligation_term_months: offer.metadata.obligationTermMonths,
        ownership_transfer_months: offer.metadata.ownershipTransferMonths,
        management_type: offer.managementType,
        maintenance_cycle_months: offer.metadata.maintenanceCycleMonths,
        maintenance_period_months: null,
        commitment_period_months: offer.metadata.obligationTermMonths,
        promo_duration_months: offer.metadata.promoDurationMonths,
        post_promo_monthly_fee: offer.metadata.postPromoMonthlyFee,
        support_pricing_model: offer.supportPricingModel,
        support_amount: offer.supportAmount,
        support_amount_min: offer.supportAmountMin,
        support_amount_max: offer.supportAmountMax,
        rating: product.metadata.rating,
        review_count: product.metadata.reviewCount,
        order_count: product.metadata.orderCount,
        ranking_rank: null,
        feature_tags_json: toJsonCell(product.featureTags),
        metadata_json: toJsonCell({
          productMetadata: product.metadata,
          offerMetadata: offer.metadata,
        }),
      });
    });
  });

  return rows;
}

async function writeCsvPair(
  outputDir: string,
  productsCsvContent: string,
  offersCsvContent: string,
  timestamp: string,
): Promise<{
  latestProductsCsvPath: string;
  latestOffersCsvPath: string;
  timestampedProductsCsvPath: string;
  timestampedOffersCsvPath: string;
}> {
  const latestProductsCsvPath = path.join(outputDir, 'latest-products.csv');
  const latestOffersCsvPath = path.join(outputDir, 'latest-offers.csv');
  const timestampedProductsCsvPath = path.join(outputDir, `${timestamp}-products.csv`);
  const timestampedOffersCsvPath = path.join(outputDir, `${timestamp}-offers.csv`);

  await Promise.all([
    writeFile(latestProductsCsvPath, productsCsvContent, 'utf8'),
    writeFile(latestOffersCsvPath, offersCsvContent, 'utf8'),
    writeFile(timestampedProductsCsvPath, productsCsvContent, 'utf8'),
    writeFile(timestampedOffersCsvPath, offersCsvContent, 'utf8'),
  ]);

  return {
    latestProductsCsvPath,
    latestOffersCsvPath,
    timestampedProductsCsvPath,
    timestampedOffersCsvPath,
  };
}

export async function exportWaterPurifierCsv(
  fetchImpl: FetchLike = fetch,
  outputDir: string = path.join(process.cwd(), 'exports', 'water-purifier'),
): Promise<WaterPurifierCsvExportResult> {
  const result = await crawlAllWaterPurifierCatalogs(fetchImpl);
  const productRows = buildWaterPurifierProductCsvRows(result);
  const offerRows = buildWaterPurifierOfferCsvRows(result);
  const productsCsvContent = renderCsv(productRows, PRODUCT_CSV_COLUMNS);
  const offersCsvContent = renderCsv(offerRows, OFFER_CSV_COLUMNS);
  const timestamp = sanitizeTimestamp(result.fetchedAt);

  await mkdir(outputDir, { recursive: true });

  const paths = await writeCsvPair(outputDir, productsCsvContent, offersCsvContent, timestamp);

  return {
    outputDir,
    ...paths,
    summary: result.summary,
  };
}

async function main(): Promise<void> {
  const exported = await exportWaterPurifierCsv();
  console.log(JSON.stringify(exported, null, 2));
}

if (require.main === module) {
  void main();
}
