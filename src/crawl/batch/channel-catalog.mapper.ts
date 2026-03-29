import type {
  AjdWaterPurifierCatalog,
  AjdWaterPurifierOffer,
  AjdWaterPurifierProduct,
} from '../ajd-water-purifier.crawler';
import type {
  MisoWaterPurifierCatalog,
  MisoWaterPurifierOffer,
  MisoWaterPurifierProduct,
} from '../miso-water-purifier.crawler';
import type {
  RentreWaterPurifierCatalog,
  RentreWaterPurifierOffer,
  RentreWaterPurifierProduct,
} from '../rentre-water-purifier.crawler';
import type {
  ChannelCatalogData,
  ChannelSlug,
  CurrentCrawledOfferRow,
  CurrentCrawledProductRow,
} from './batch.types';

type SupportedCatalog =
  | AjdWaterPurifierCatalog
  | MisoWaterPurifierCatalog
  | RentreWaterPurifierCatalog;

function createBaseProductRow(
  channel: ChannelSlug,
  fetchedAt: string,
  sourceUrl: string,
  product: AjdWaterPurifierProduct | MisoWaterPurifierProduct | RentreWaterPurifierProduct,
): CurrentCrawledProductRow {
  return {
    channel,
    fetchedAt,
    sourceUrl,
    externalProductId: product.externalProductId,
    brandName: product.brandName,
    productName: product.productName,
    modelCode: product.modelCode,
    detailUrl: product.detailUrl,
    thumbnailUrl: product.thumbnailUrl,
    featureTags: product.featureTags,
    offerCount: product.offers.length,
    rating: null,
    reviewCount: null,
    orderCount: null,
    rankingRank: null,
    metadata: product.metadata,
  };
}

function createAjdOfferRow(
  fetchedAt: string,
  sourceUrl: string,
  product: AjdWaterPurifierProduct,
  offer: AjdWaterPurifierOffer,
): CurrentCrawledOfferRow {
  return {
    channel: 'ajd',
    fetchedAt,
    sourceUrl,
    externalProductId: product.externalProductId,
    externalOfferId: offer.externalOfferId,
    brandName: product.brandName,
    productName: product.productName,
    modelCode: product.modelCode,
    productDetailUrl: product.detailUrl,
    offerUrl: offer.publicOfferUrl,
    publicMonthlyFee: offer.publicMonthlyFee,
    cardAppliedMonthlyFee: offer.cardAppliedMonthlyFee,
    cardDiscountAmount: offer.metadata.cardDiscountAmount ?? null,
    hasAffiliateCard:
      typeof offer.metadata.cardDiscountAmount === 'number' &&
      Number.isFinite(offer.metadata.cardDiscountAmount),
    primaryCardCompany: offer.metadata.cardCompanies?.[0] ?? null,
    primaryCardName: offer.metadata.cardNames?.[0] ?? null,
    cardCompanies: offer.metadata.cardCompanies ?? [],
    cardNames: offer.metadata.cardNames ?? [],
    contractTermMonths: offer.contractTermMonths,
    obligationTermMonths: offer.contractTermMonths,
    ownershipTransferMonths: null,
    managementType: offer.managementType,
    maintenanceCycleMonths: null,
    maintenancePeriodMonths: null,
    commitmentPeriodMonths: null,
    promoDurationMonths: null,
    postPromoMonthlyFee: null,
    supportPricingModel: offer.supportPricingModel,
    supportAmount: offer.supportAmount,
    supportAmountMin: offer.supportAmountMin,
    supportAmountMax: offer.supportAmountMax,
    rating: null,
    reviewCount: product.metadata.reviewCount,
    orderCount: null,
    rankingRank: product.rankingRank,
    featureTags: product.featureTags,
    metadata: {
      productMetadata: product.metadata,
      offerMetadata: offer.metadata,
    },
  };
}

function createMisoOfferRow(
  fetchedAt: string,
  sourceUrl: string,
  product: MisoWaterPurifierProduct,
  offer: MisoWaterPurifierOffer,
): CurrentCrawledOfferRow {
  return {
    channel: 'miso',
    fetchedAt,
    sourceUrl,
    externalProductId: product.externalProductId,
    externalOfferId: offer.externalOfferId,
    brandName: product.brandName,
    productName: product.productName,
    modelCode: product.modelCode,
    productDetailUrl: product.detailUrl,
    offerUrl: offer.publicOfferUrl,
    publicMonthlyFee: offer.publicMonthlyFee,
    cardAppliedMonthlyFee: offer.cardAppliedMonthlyFee,
    cardDiscountAmount: offer.cardDiscountAmount,
    hasAffiliateCard: offer.cardDiscountAmount !== null,
    primaryCardCompany: null,
    primaryCardName: null,
    cardCompanies: [],
    cardNames: [],
    contractTermMonths: offer.contractTermMonths,
    obligationTermMonths: offer.metadata.commitmentPeriodMonths,
    ownershipTransferMonths: null,
    managementType: offer.managementType,
    maintenanceCycleMonths: offer.metadata.maintenancePeriodMonths,
    maintenancePeriodMonths: offer.metadata.maintenancePeriodMonths,
    commitmentPeriodMonths: offer.metadata.commitmentPeriodMonths,
    promoDurationMonths: null,
    postPromoMonthlyFee: null,
    supportPricingModel: offer.supportPricingModel,
    supportAmount: offer.supportAmount,
    supportAmountMin: offer.supportAmountMin,
    supportAmountMax: offer.supportAmountMax,
    rating: null,
    reviewCount: null,
    orderCount: null,
    rankingRank: product.metadata.listingRank,
    featureTags: product.featureTags,
    metadata: {
      productMetadata: product.metadata,
      offerMetadata: offer.metadata,
    },
  };
}

function createRentreOfferRow(
  fetchedAt: string,
  sourceUrl: string,
  product: RentreWaterPurifierProduct,
  offer: RentreWaterPurifierOffer,
): CurrentCrawledOfferRow {
  return {
    channel: 'rentre',
    fetchedAt,
    sourceUrl,
    externalProductId: product.externalProductId,
    externalOfferId: offer.externalOfferId,
    brandName: product.brandName,
    productName: product.productName,
    modelCode: product.modelCode,
    productDetailUrl: product.detailUrl,
    offerUrl: offer.publicOfferUrl,
    publicMonthlyFee: offer.publicMonthlyFee,
    cardAppliedMonthlyFee: offer.cardAppliedMonthlyFee,
    cardDiscountAmount: offer.metadata.affiliateCardDiscountAmount,
    hasAffiliateCard: offer.metadata.hasAffiliateCard,
    primaryCardCompany: offer.metadata.cardCompanies[0] ?? null,
    primaryCardName: offer.metadata.cardNames[0] ?? null,
    cardCompanies: offer.metadata.cardCompanies,
    cardNames: offer.metadata.cardNames,
    contractTermMonths: offer.contractTermMonths,
    obligationTermMonths: offer.metadata.obligationTermMonths,
    ownershipTransferMonths: offer.metadata.ownershipTransferMonths,
    managementType: offer.managementType,
    maintenanceCycleMonths: offer.metadata.maintenanceCycleMonths,
    maintenancePeriodMonths: null,
    commitmentPeriodMonths: offer.metadata.obligationTermMonths,
    promoDurationMonths: offer.metadata.promoDurationMonths,
    postPromoMonthlyFee: offer.metadata.postPromoMonthlyFee,
    supportPricingModel: offer.supportPricingModel,
    supportAmount: offer.supportAmount,
    supportAmountMin: offer.supportAmountMin,
    supportAmountMax: offer.supportAmountMax,
    rating: product.metadata.rating,
    reviewCount: product.metadata.reviewCount,
    orderCount: product.metadata.orderCount,
    rankingRank: null,
    featureTags: product.featureTags,
    metadata: {
      productMetadata: product.metadata,
      offerMetadata: offer.metadata,
    },
  };
}

export function mapChannelCatalogToCurrentRows(
  channel: 'ajd',
  catalog: AjdWaterPurifierCatalog,
): ChannelCatalogData;
export function mapChannelCatalogToCurrentRows(
  channel: 'miso',
  catalog: MisoWaterPurifierCatalog,
): ChannelCatalogData;
export function mapChannelCatalogToCurrentRows(
  channel: 'rentre',
  catalog: RentreWaterPurifierCatalog,
): ChannelCatalogData;
export function mapChannelCatalogToCurrentRows(
  channel: ChannelSlug,
  catalog: SupportedCatalog,
): ChannelCatalogData {
  if (channel === 'ajd') {
    const typedCatalog = catalog as AjdWaterPurifierCatalog;
    return {
      products: typedCatalog.products.map((product) => ({
        ...createBaseProductRow(channel, typedCatalog.fetchedAt, typedCatalog.sourceUrl, product),
        reviewCount: product.metadata.reviewCount,
        rankingRank: product.rankingRank,
      })),
      offers: typedCatalog.products.flatMap((product) =>
        product.offers.map((offer) => createAjdOfferRow(typedCatalog.fetchedAt, typedCatalog.sourceUrl, product, offer)),
      ),
    };
  }

  if (channel === 'miso') {
    const typedCatalog = catalog as MisoWaterPurifierCatalog;
    return {
      products: typedCatalog.products.map((product) => ({
        ...createBaseProductRow(channel, typedCatalog.fetchedAt, typedCatalog.sourceUrl, product),
        rankingRank: product.metadata.listingRank,
      })),
      offers: typedCatalog.products.flatMap((product) =>
        product.offers.map((offer) =>
          createMisoOfferRow(typedCatalog.fetchedAt, typedCatalog.sourceUrl, product, offer),
        ),
      ),
    };
  }

  const typedCatalog = catalog as RentreWaterPurifierCatalog;

  return {
    products: typedCatalog.products.map((product) => ({
      ...createBaseProductRow(channel, typedCatalog.fetchedAt, typedCatalog.sourceUrl, product),
      rating: product.metadata.rating,
      reviewCount: product.metadata.reviewCount,
      orderCount: product.metadata.orderCount,
    })),
    offers: typedCatalog.products.flatMap((product) =>
      product.offers.map((offer) =>
        createRentreOfferRow(typedCatalog.fetchedAt, typedCatalog.sourceUrl, product, offer),
      ),
    ),
  };
}

export type { ChannelCatalogData, CurrentCrawledOfferRow, CurrentCrawledProductRow };
