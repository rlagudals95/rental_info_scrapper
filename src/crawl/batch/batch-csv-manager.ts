import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  OFFER_CSV_COLUMNS,
  PRODUCT_CSV_COLUMNS,
  renderCsv,
} from '../export-water-purifier-csv';
import type {
  BatchCsvWriteInput,
  BatchCsvWriteResult,
  CurrentCrawledOfferRow,
  CurrentCrawledProductRow,
} from './batch.types';

type CsvCellValue = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvCellValue>;

function sanitizeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function toJsonCell(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function buildProductCsvRows(rows: readonly CurrentCrawledProductRow[]): CsvRow[] {
  return rows.map((row) => ({
    channel: row.channel,
    fetched_at: row.fetchedAt,
    source_url: row.sourceUrl,
    external_product_id: row.externalProductId,
    brand_name: row.brandName,
    product_name: row.productName,
    model_code: row.modelCode,
    detail_url: row.detailUrl,
    thumbnail_url: row.thumbnailUrl,
    feature_tags_json: toJsonCell(row.featureTags),
    offer_count: row.offerCount,
    rating: row.rating,
    review_count: row.reviewCount,
    order_count: row.orderCount,
    ranking_rank: row.rankingRank,
    metadata_json: toJsonCell(row.metadata),
  }));
}

function buildOfferCsvRows(rows: readonly CurrentCrawledOfferRow[]): CsvRow[] {
  return rows.map((row) => ({
    channel: row.channel,
    fetched_at: row.fetchedAt,
    source_url: row.sourceUrl,
    external_product_id: row.externalProductId,
    external_offer_id: row.externalOfferId,
    brand_name: row.brandName,
    product_name: row.productName,
    model_code: row.modelCode,
    product_detail_url: row.productDetailUrl,
    offer_url: row.offerUrl,
    public_monthly_fee: row.publicMonthlyFee,
    card_applied_monthly_fee: row.cardAppliedMonthlyFee,
    card_discount_amount: row.cardDiscountAmount,
    has_affiliate_card: row.hasAffiliateCard,
    primary_card_company: row.primaryCardCompany,
    primary_card_name: row.primaryCardName,
    card_companies_json: toJsonCell(row.cardCompanies),
    card_names_json: toJsonCell(row.cardNames),
    contract_term_months: row.contractTermMonths,
    obligation_term_months: row.obligationTermMonths,
    ownership_transfer_months: row.ownershipTransferMonths,
    management_type: row.managementType,
    maintenance_cycle_months: row.maintenanceCycleMonths,
    maintenance_period_months: row.maintenancePeriodMonths,
    commitment_period_months: row.commitmentPeriodMonths,
    promo_duration_months: row.promoDurationMonths,
    post_promo_monthly_fee: row.postPromoMonthlyFee,
    support_pricing_model: row.supportPricingModel,
    support_amount: row.supportAmount,
    support_amount_min: row.supportAmountMin,
    support_amount_max: row.supportAmountMax,
    rating: row.rating,
    review_count: row.reviewCount,
    order_count: row.orderCount,
    ranking_rank: row.rankingRank,
    feature_tags_json: toJsonCell(row.featureTags),
    metadata_json: toJsonCell(row.metadata),
  }));
}

export async function writeBatchCsvFiles(
  input: BatchCsvWriteInput,
): Promise<BatchCsvWriteResult> {
  const timestamp = sanitizeTimestamp(input.fetchedAt);
  const latestProductsCsvPath = path.join(input.outputDir, 'latest-products.csv');
  const latestOffersCsvPath = path.join(input.outputDir, 'latest-offers.csv');
  const archivedProductsCsvPath = input.shouldArchive
    ? path.join(input.outputDir, `${timestamp}-products.csv`)
    : null;
  const archivedOffersCsvPath = input.shouldArchive
    ? path.join(input.outputDir, `${timestamp}-offers.csv`)
    : null;
  const productsCsvContent = renderCsv(buildProductCsvRows(input.products), PRODUCT_CSV_COLUMNS);
  const offersCsvContent = renderCsv(buildOfferCsvRows(input.offers), OFFER_CSV_COLUMNS);

  await mkdir(input.outputDir, { recursive: true });
  await Promise.all([
    writeFile(latestProductsCsvPath, productsCsvContent, 'utf8'),
    writeFile(latestOffersCsvPath, offersCsvContent, 'utf8'),
    ...(archivedProductsCsvPath ? [writeFile(archivedProductsCsvPath, productsCsvContent, 'utf8')] : []),
    ...(archivedOffersCsvPath ? [writeFile(archivedOffersCsvPath, offersCsvContent, 'utf8')] : []),
  ]);

  return {
    latestProductsCsvPath,
    latestOffersCsvPath,
    archivedProductsCsvPath,
    archivedOffersCsvPath,
  };
}
