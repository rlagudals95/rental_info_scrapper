import type { ManagementType, SupportPricingModel } from '../../comparison/comparison.types';

export type ChannelSlug = 'ajd' | 'miso' | 'rentre';
export type BatchTriggerType = 'scheduled' | 'manual';
export type BatchRunStatus = 'running' | 'success' | 'partial_success' | 'failed';
export type DriftStatus = 'ok' | 'warning' | 'critical' | 'informational';

export interface ChannelQualityMetrics {
  offersCount: number;
  contractTermNullRate: number;
  managementTypeNullRate: number;
  primaryCardCompanyNullRate: number;
  affiliateCardOfferCount: number;
  affiliateCardCompanyFilledCount: number;
  affiliateCardNameFilledCount: number;
}

export interface DriftDetectionResult {
  status: DriftStatus;
  warnings: string[];
}

export interface CurrentCrawledProductRow {
  channel: ChannelSlug;
  fetchedAt: string;
  sourceUrl: string;
  externalProductId: string;
  brandName: string;
  productName: string;
  modelCode: string;
  detailUrl: string;
  thumbnailUrl: string | null;
  featureTags: string[];
  offerCount: number;
  rating: number | null;
  reviewCount: number | null;
  orderCount: number | null;
  rankingRank: number | null;
  metadata: Record<string, unknown>;
}

export interface CurrentCrawledOfferRow {
  channel: ChannelSlug;
  fetchedAt: string;
  sourceUrl: string;
  externalProductId: string;
  externalOfferId: string;
  brandName: string;
  productName: string;
  modelCode: string;
  productDetailUrl: string;
  offerUrl: string;
  publicMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  cardDiscountAmount: number | null;
  hasAffiliateCard: boolean;
  primaryCardCompany: string | null;
  primaryCardName: string | null;
  cardCompanies: string[];
  cardNames: string[];
  contractTermMonths: number | null;
  obligationTermMonths: number | null;
  ownershipTransferMonths: number | null;
  managementType: ManagementType | null;
  maintenanceCycleMonths: number | null;
  maintenancePeriodMonths: number | null;
  commitmentPeriodMonths: number | null;
  promoDurationMonths: number | null;
  postPromoMonthlyFee: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  rating: number | null;
  reviewCount: number | null;
  orderCount: number | null;
  rankingRank: number | null;
  featureTags: string[];
  metadata: Record<string, unknown>;
}

export interface ChannelCatalogData {
  products: CurrentCrawledProductRow[];
  offers: CurrentCrawledOfferRow[];
}

export interface BatchCsvWriteInput {
  outputDir: string;
  fetchedAt: string;
  products: readonly CurrentCrawledProductRow[];
  offers: readonly CurrentCrawledOfferRow[];
  shouldArchive: boolean;
}

export interface BatchCsvWriteResult {
  latestProductsCsvPath: string;
  latestOffersCsvPath: string;
  archivedProductsCsvPath: string | null;
  archivedOffersCsvPath: string | null;
}
