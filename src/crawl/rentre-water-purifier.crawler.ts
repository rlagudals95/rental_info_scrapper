import { ManagementType, SupportPricingModel } from '../comparison/comparison.types';
import { mapWithConcurrency, retryAsync } from './crawl-execution.util';
import {
  buildRentreDetailFallback,
  parseRentreDetailPageData,
  RentreDetailFallback,
} from './rentre-detail-page.parser';

export const RENTRE_WATER_PURIFIER_LIST_URL = 'https://rentre.kr/water-purifier';
export const RENTRE_PRODUCT_LIST_URL = 'https://api.doublecheck.kr/api/v3/product/listBySearch';
export const RENTRE_NEW_PRODUCT_LIST_URL = 'https://api.doublecheck.kr/api/v2/product/new/list';
export const RENTRE_PROPOSAL_LIST_URL =
  'https://api.doublecheck.kr/api/proposalRequest/list/ByProdOption';
export const RENTRE_FEATURED_AFFILIATE_CARD_URL =
  'https://api.doublecheck.kr/api/product/afltnCard/featured';
export const RENTRE_WATER_PURIFIER_PAGE_SIZE = 100;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const DETAIL_ENRICHMENT_CONCURRENCY = 12;
const DETAIL_FETCH_ATTEMPTS = 3;

type FetchLike = typeof fetch;
type RentreListingSection = 'main_list' | 'new_arrivals';
type RentreBenefitEvidence = 'api_payback_fixed' | 'api_payback_range' | 'api_payback_hidden';
type RentreTermDiscoverySource = 'proposal_badges' | 'list_only';
type RentrePriceSource = 'list_api_main' | 'list_api_by_term';
type RentreManagementDiscoverySource = 'proposal_badges' | 'detail_payload' | 'list_only';

interface RentreBadgeResponseItem {
  prodBadgeUsid: number;
  title: string;
  badgeType: string;
  badgeOrder: number;
}

interface RentreBadgeResponse {
  top?: RentreBadgeResponseItem[] | null;
  bottom?: RentreBadgeResponseItem[] | null;
  img?: RentreBadgeResponseItem[] | null;
}

interface RentreReviewScoreCountResponse {
  prodUsid: number;
  totalCount: number;
  totalAvgScore: string | null;
}

interface RentrePaybackResponse {
  prodUsid: number;
  noData: boolean;
  minPayback: number | null;
  maxPayback: number | null;
  minPaybackForDisplay: number | null;
  maxPaybackForDisplay: number | null;
  sameMinMax: boolean;
}

interface RentreProposalSummaryResponse {
  displayBenefit: boolean;
  propItemSubsPrice: number | null;
  propItemPaybackDisc: number | null;
  propItemVoucher: number | null;
  propItemTotalCashableBenefit: number | null;
  hasAlpha: boolean;
  hasConfirmed: boolean;
  pricePromotionYn: boolean;
  pricePromotionAmount: number | null;
  pricePromotionPeriod: number | null;
  pricePromotionRate: number | null;
}

interface RentreFeaturedAffiliateCardInfoResponse {
  afltnCardInfoUsid: number;
  minAfltnCardLstMonResult: number | null;
  maxAfltnCardLstMonResult: number | null;
  afltnCardDisc: number | null;
  defaultYn: boolean;
  promotionDisc: number | null;
  promotionCnt: number | null;
  promotionEndDate: string | null;
  totalDisc: number | null;
}

export interface RentreFeaturedAffiliateCardResponse {
  afltnCardUsid: number;
  afltnCardName: string | null;
  afltnCardCompany: string | null;
  afltnCardImg: string | null;
  mandatoryCnt: number | null;
  subsPrice: number | null;
  noCalculator?: boolean;
  afltnCardInfoList?: RentreFeaturedAffiliateCardInfoResponse[] | null;
}

export interface RentreProposalRequestResponseItem {
  name: string;
  address: string;
  prodUsid: number;
  prodOptionUsid: number;
  prodTermUsid: number;
  prodName: string;
  repProdName: string;
  prodOptionThumImgUrl: string | null;
  prodOptionModelCode: string;
  brandKorean: string;
  badgeList?: string[] | null;
  isTps: boolean;
  propSummaryList?: RentreProposalSummaryResponse[] | null;
}

export interface RentreProductListItemResponse {
  prodUsid: number;
  prodOptionUsid: number;
  prodTermUsid: number;
  eos: boolean;
  brand: string;
  brandKorean: string;
  brandIconImgUrl: string | null;
  prodOptionThumImgUrl: string | null;
  prodName: string;
  repProdName: string;
  originProdName: string;
  prodOptionModelCode: string;
  prodCatg: string;
  prodCatgKorean: string;
  rentalCompany: string | null;
  hasTvOption: boolean;
  hasTelOption: boolean;
  minNowProjSubsPrice: number | null;
  originMinNowProjSubsPrice: number | null;
  minNowProjSubsPriceIsHalfPricePromotion: boolean;
  minNowProjSubsPriceHalfPricePromotionPeriod: number;
  hasAfltnCard: boolean;
  afltnCardDisc: number | null;
  fastDeliveryYn: boolean;
  halfPricePromotion: boolean;
  contractCount: number;
  expectDiscountRate: number;
  prodBadgeResponse?: RentreBadgeResponse | null;
  prodReviewScoreCountResponse?: RentreReviewScoreCountResponse | null;
  prodPaybackResponse?: RentrePaybackResponse | null;
}

interface RentrePageResponse {
  data: RentreProductListItemResponse[];
  page: {
    total: number;
    pageNum: number;
    size: number;
    pages: number;
    lastPageYn: boolean;
    hasNextPage: boolean;
  };
}

export interface RentreParsedBadgeAttributes {
  contractTermMonths: number | null;
  obligationTermMonths: number | null;
  ownershipTransferMonths: number | null;
  managementType: ManagementType | null;
  maintenanceCycleMonths: number | null;
}

export interface RentreProposalTermDetail extends RentreParsedBadgeAttributes {
  prodTermUsid: number;
  badgeList: string[];
  observedRecentQuoteCount: number;
}

interface RentreCatalogEnrichment {
  proposalTermsByProdOptionUsid?: ReadonlyMap<number, readonly RentreProposalTermDetail[]>;
  termListingsByProdTermUsid?: ReadonlyMap<number, RentreProductListItemResponse>;
  detailFallbackByProdOptionUsid?: ReadonlyMap<number, RentreDetailFallback>;
  featuredAffiliateCardByProdTermUsid?: ReadonlyMap<number, RentreFeaturedAffiliateCardResponse>;
}

export interface RentreWaterPurifierOffer {
  externalOfferId: string;
  prodTermUsid: number;
  offerName: string;
  publicOfferUrl: string;
  contractTermMonths: number | null;
  managementType: ManagementType | null;
  publicMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  metadata: {
    postPromoMonthlyFee: number | null;
    promoDurationMonths: number | null;
    expectDiscountRate: number;
    affiliateCardDiscountAmount: number | null;
    hasAffiliateCard: boolean;
    sections: RentreListingSection[];
    benefitEvidence: RentreBenefitEvidence;
    obligationTermMonths: number | null;
    ownershipTransferMonths: number | null;
    maintenanceCycleMonths: number | null;
    termDiscoverySource: RentreTermDiscoverySource;
    managementDiscoverySource: RentreManagementDiscoverySource;
    priceSource: RentrePriceSource;
    managementTypeOptions: ManagementType[];
    promoTermHintMonths: number[];
    benefitHighlights: string[];
    cardNames: string[];
    cardCompanies: string[];
    cardImageUrl: string | null;
  };
}

export interface RentreWaterPurifierProduct {
  externalProductId: string;
  prodOptionUsid: number;
  prodUsid: number;
  brandName: string;
  productName: string;
  modelCode: string;
  detailUrl: string;
  thumbnailUrl: string | null;
  featureTags: string[];
  metadata: {
    sections: RentreListingSection[];
    badges: string[];
    rating: number | null;
    reviewCount: number | null;
    orderCount: number;
    expectDiscountRate: number;
    hasAffiliateCard: boolean;
    affiliateCardDiscountAmount: number | null;
    isHalfPricePromotion: boolean;
    promoDurationMonths: number | null;
    postPromoMonthlyFee: number | null;
    brandCode: string;
    rentalCompany: string | null;
  };
  offers: RentreWaterPurifierOffer[];
}

export interface RentreWaterPurifierCatalog {
  fetchedAt: string;
  sourceUrl: string;
  sourceApiUrl: string;
  newArrivalApiUrl: string;
  pageTotalCount: number;
  mainListCount: number;
  newArrivalCount: number;
  productsCount: number;
  offersCount: number;
  products: RentreWaterPurifierProduct[];
}

interface SupportPricingResolution {
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  benefitEvidence: RentreBenefitEvidence;
}

function createRequestHeaders(): Record<string, string> {
  return {
    'user-agent': DEFAULT_USER_AGENT,
  };
}

function createRentreListUrl(
  page: number,
  row: number,
  extraParams: Record<string, string | number | boolean | null | undefined> = {},
): string {
  const params = new URLSearchParams({
    prodOrderType: 'Popular',
    prodCatg: 'WATER_PURIFIER',
    hasProdTelOption: 'false',
    hasProdTvOption: 'true',
    page: String(page),
    row: String(row),
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    params.append(key, String(value));
  });

  return `${RENTRE_PRODUCT_LIST_URL}?${params.toString()}`;
}

function createRentreNewListUrl(): string {
  const params = new URLSearchParams({
    prodCatg: 'WATER_PURIFIER',
  });

  return `${RENTRE_NEW_PRODUCT_LIST_URL}?${params.toString()}`;
}

function createRentreProposalListUrl(prodOptionUsid: number): string {
  const params = new URLSearchParams({
    prodOptionUsid: String(prodOptionUsid),
  });

  return `${RENTRE_PROPOSAL_LIST_URL}?${params.toString()}`;
}

function createRentreProdTermUrl(prodTermUsid: number): string {
  return createRentreListUrl(1, 20, {
    prodTermUsidList: prodTermUsid,
  });
}

function createRentreFeaturedAffiliateCardUrl(prodTermUsid: number): string {
  const params = new URLSearchParams({
    prodTermUsid: String(prodTermUsid),
  });

  return `${RENTRE_FEATURED_AFFILIATE_CARD_URL}?${params.toString()}`;
}

function createDetailUrl(prodOptionUsid: number): string {
  return `https://rentre.kr/product/${prodOptionUsid}`;
}

async function fetchRentreDetailHtml(
  prodOptionUsid: number,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const response = await fetchImpl(createDetailUrl(prodOptionUsid), {
    headers: createRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre detail page: ${response.status}`);
  }

  return response.text();
}

function collectBadgeTitles(response: RentreBadgeResponse | null | undefined): string[] {
  return [...(response?.top ?? []), ...(response?.bottom ?? []), ...(response?.img ?? [])]
    .map((badge) => badge.title.trim())
    .filter((title) => title.length > 0);
}

function extractFeatureTags(rawValue: string): string[] {
  const resolvedTags = new Set<string>();
  const mapping: Array<{ pattern: string; tags: string[] }> = [
    { pattern: '얼음', tags: ['얼음'] },
    { pattern: '이온수', tags: ['이온수'] },
    { pattern: '살균수', tags: ['살균수'] },
    { pattern: '냉온정', tags: ['냉수', '온수', '정수'] },
    { pattern: '냉정', tags: ['냉수', '정수'] },
    { pattern: '온정', tags: ['온수', '정수'] },
    { pattern: '정수', tags: ['정수'] },
    { pattern: '냉수', tags: ['냉수'] },
    { pattern: '온수', tags: ['온수'] },
  ];

  for (const candidate of mapping) {
    if (rawValue.includes(candidate.pattern)) {
      candidate.tags.forEach((tag) => resolvedTags.add(tag));
    }
  }

  return Array.from(resolvedTags);
}

function toRating(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolvePromoDurationMonths(item: RentreProductListItemResponse): number | null {
  return item.minNowProjSubsPriceIsHalfPricePromotion &&
    item.minNowProjSubsPriceHalfPricePromotionPeriod > 0
    ? item.minNowProjSubsPriceHalfPricePromotionPeriod
    : null;
}

function calculateRentreCardAppliedMonthlyFee(
  publicMonthlyFee: number | null,
  affiliateCardDiscountAmount: number | null,
  hasAffiliateCard: boolean,
): number | null {
  if (!hasAffiliateCard || publicMonthlyFee === null || affiliateCardDiscountAmount === null) {
    return null;
  }

  return Math.max(publicMonthlyFee - affiliateCardDiscountAmount, 0);
}

function normalizeRentreCardMetadata(
  featuredAffiliateCard: RentreFeaturedAffiliateCardResponse | null,
): {
  cardNames: string[];
  cardCompanies: string[];
  cardImageUrl: string | null;
} {
  if (!featuredAffiliateCard) {
    return {
      cardNames: [],
      cardCompanies: [],
      cardImageUrl: null,
    };
  }

  const cardNames = featuredAffiliateCard.afltnCardName?.trim()
    ? [featuredAffiliateCard.afltnCardName.trim()]
    : [];
  const cardCompanies = featuredAffiliateCard.afltnCardCompany?.trim()
    ? [featuredAffiliateCard.afltnCardCompany.trim()]
    : [];

  return {
    cardNames,
    cardCompanies,
    cardImageUrl: featuredAffiliateCard.afltnCardImg?.trim() || null,
  };
}

function resolveSupportPricing(
  paybackResponse: RentrePaybackResponse | null | undefined,
): SupportPricingResolution {
  if (!paybackResponse || paybackResponse.noData) {
    return {
      supportPricingModel: 'hidden',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
      benefitEvidence: 'api_payback_hidden',
    };
  }

  const min = paybackResponse.minPayback;
  const max = paybackResponse.maxPayback;

  if (typeof min === 'number' && typeof max === 'number' && min !== max) {
    return {
      supportPricingModel: 'range_public',
      supportAmount: null,
      supportAmountMin: min,
      supportAmountMax: max,
      benefitEvidence: 'api_payback_range',
    };
  }

  const resolvedAmount = min ?? max;

  if (typeof resolvedAmount === 'number') {
    return {
      supportPricingModel: 'fixed_public',
      supportAmount: resolvedAmount,
      supportAmountMin: null,
      supportAmountMax: null,
      benefitEvidence: 'api_payback_fixed',
    };
  }

  return {
    supportPricingModel: 'hidden',
    supportAmount: null,
    supportAmountMin: null,
    supportAmountMax: null,
    benefitEvidence: 'api_payback_hidden',
  };
}

function mergeSections(
  left: readonly RentreListingSection[],
  right: readonly RentreListingSection[],
): RentreListingSection[] {
  return Array.from(new Set([...left, ...right]));
}

function parseRentreMonthBadge(rawBadge: string, suffix: string): number | null {
  const pattern = new RegExp(`^(\\d+)개월 ${suffix}$`);
  const match = rawBadge.match(pattern);

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function resolveContractTermMonths(
  obligationTermMonths: number | null,
  ownershipTransferMonths: number | null,
): number | null {
  return ownershipTransferMonths ?? obligationTermMonths;
}

export function parseRentreProposalBadges(
  badgeList: readonly string[],
): RentreParsedBadgeAttributes {
  let obligationTermMonths: number | null = null;
  let ownershipTransferMonths: number | null = null;
  let managementType: ManagementType | null = null;
  let maintenanceCycleMonths: number | null = null;

  badgeList.forEach((rawBadge) => {
    const badge = rawBadge.trim();

    obligationTermMonths ??= parseRentreMonthBadge(badge, '의무사용');
    ownershipTransferMonths ??= parseRentreMonthBadge(badge, '소유권이전');

    if (managementType === null) {
      if (badge.includes('셀프관리')) {
        managementType = 'self';
      } else if (badge.includes('방문관리')) {
        managementType = 'visit';
      }
    }

    if (maintenanceCycleMonths === null) {
      maintenanceCycleMonths = parseRentreMonthBadge(badge, '주기');
    }
  });

  return {
    contractTermMonths: resolveContractTermMonths(
      obligationTermMonths,
      ownershipTransferMonths,
    ),
    obligationTermMonths,
    ownershipTransferMonths,
    managementType,
    maintenanceCycleMonths,
  };
}

export function buildRentreProposalTermDetails(
  proposals: readonly RentreProposalRequestResponseItem[],
): RentreProposalTermDetail[] {
  const termMap = new Map<number, RentreProposalTermDetail>();

  proposals.forEach((proposal) => {
    const badgeList = (proposal.badgeList ?? [])
      .map((badge) => badge.trim())
      .filter((badge) => badge.length > 0);

    const parsed = parseRentreProposalBadges(badgeList);
    const existing = termMap.get(proposal.prodTermUsid);

    if (!existing) {
      termMap.set(proposal.prodTermUsid, {
        prodTermUsid: proposal.prodTermUsid,
        badgeList,
        observedRecentQuoteCount: 1,
        ...parsed,
      });
      return;
    }

    termMap.set(proposal.prodTermUsid, {
      prodTermUsid: proposal.prodTermUsid,
      badgeList: existing.badgeList.length > 0 ? existing.badgeList : badgeList,
      observedRecentQuoteCount: existing.observedRecentQuoteCount + 1,
      contractTermMonths: existing.contractTermMonths ?? parsed.contractTermMonths,
      obligationTermMonths: existing.obligationTermMonths ?? parsed.obligationTermMonths,
      ownershipTransferMonths:
        existing.ownershipTransferMonths ?? parsed.ownershipTransferMonths,
      managementType: existing.managementType ?? parsed.managementType,
      maintenanceCycleMonths:
        existing.maintenanceCycleMonths ?? parsed.maintenanceCycleMonths,
    });
  });

  return Array.from(termMap.values()).sort((left, right) => {
    const leftTerm = left.contractTermMonths ?? Number.MAX_SAFE_INTEGER;
    const rightTerm = right.contractTermMonths ?? Number.MAX_SAFE_INTEGER;

    if (leftTerm !== rightTerm) {
      return leftTerm - rightTerm;
    }

    return left.prodTermUsid - right.prodTermUsid;
  });
}

function mapRentreListingItemToOffer(
  item: RentreProductListItemResponse,
  section: RentreListingSection,
  detail: RentreProposalTermDetail | null,
  detailFallback: RentreDetailFallback | null,
  featuredAffiliateCard: RentreFeaturedAffiliateCardResponse | null,
  priceSource: RentrePriceSource,
): RentreWaterPurifierOffer {
  const supportPricing = resolveSupportPricing(item.prodPaybackResponse);
  const promoDurationMonths = resolvePromoDurationMonths(item);
  const resolvedManagementType =
    detail?.managementType ?? detailFallback?.resolvedManagementType ?? null;
  const cardMetadata = normalizeRentreCardMetadata(featuredAffiliateCard);

  return {
    externalOfferId: `rentre:${item.prodOptionUsid}:${item.prodTermUsid}`,
    prodTermUsid: item.prodTermUsid,
    offerName: `${item.brandKorean} ${item.prodName}`.trim(),
    publicOfferUrl: createDetailUrl(item.prodOptionUsid),
    contractTermMonths: detail?.contractTermMonths ?? null,
    managementType: resolvedManagementType,
    publicMonthlyFee: item.minNowProjSubsPrice,
    cardAppliedMonthlyFee: calculateRentreCardAppliedMonthlyFee(
      item.minNowProjSubsPrice,
      item.afltnCardDisc,
      item.hasAfltnCard,
    ),
    supportPricingModel: supportPricing.supportPricingModel,
    supportAmount: supportPricing.supportAmount,
    supportAmountMin: supportPricing.supportAmountMin,
    supportAmountMax: supportPricing.supportAmountMax,
    metadata: {
      postPromoMonthlyFee: item.originMinNowProjSubsPrice,
      promoDurationMonths,
      expectDiscountRate: item.expectDiscountRate,
      affiliateCardDiscountAmount: item.afltnCardDisc,
      hasAffiliateCard: item.hasAfltnCard,
      sections: [section],
      benefitEvidence: supportPricing.benefitEvidence,
      obligationTermMonths: detail?.obligationTermMonths ?? null,
      ownershipTransferMonths: detail?.ownershipTransferMonths ?? null,
      maintenanceCycleMonths: detail?.maintenanceCycleMonths ?? null,
      termDiscoverySource: detail ? 'proposal_badges' : 'list_only',
      managementDiscoverySource: detail
        ? 'proposal_badges'
        : detailFallback?.resolvedManagementType
          ? 'detail_payload'
          : 'list_only',
      priceSource,
      managementTypeOptions: detailFallback?.managementTypeOptions ?? [],
      promoTermHintMonths: detailFallback?.promoTermHintMonths ?? [],
      benefitHighlights: detailFallback?.benefitTitles ?? [],
      cardNames: cardMetadata.cardNames,
      cardCompanies: cardMetadata.cardCompanies,
      cardImageUrl: cardMetadata.cardImageUrl,
    },
  };
}

function sortRentreOffers(offers: readonly RentreWaterPurifierOffer[]): RentreWaterPurifierOffer[] {
  return offers.slice().sort((left, right) => {
    const leftTerm = left.contractTermMonths ?? Number.MAX_SAFE_INTEGER;
    const rightTerm = right.contractTermMonths ?? Number.MAX_SAFE_INTEGER;

    if (leftTerm !== rightTerm) {
      return leftTerm - rightTerm;
    }

    if (left.managementType !== right.managementType) {
      if (left.managementType === null) {
        return 1;
      }

      if (right.managementType === null) {
        return -1;
      }

      return left.managementType.localeCompare(right.managementType);
    }

    return left.prodTermUsid - right.prodTermUsid;
  });
}

function resolveOffersForProduct(
  item: RentreProductListItemResponse,
  section: RentreListingSection,
  enrichment: RentreCatalogEnrichment | undefined,
): RentreWaterPurifierOffer[] {
  const proposalTerms = enrichment?.proposalTermsByProdOptionUsid?.get(item.prodOptionUsid) ?? [];
  const detailFallback =
    enrichment?.detailFallbackByProdOptionUsid?.get(item.prodOptionUsid) ?? null;
  const offers: RentreWaterPurifierOffer[] = [];
  const seenOfferIds = new Set<string>();

  proposalTerms.forEach((detail) => {
    const termListing = enrichment?.termListingsByProdTermUsid?.get(detail.prodTermUsid);
    const featuredAffiliateCard =
      enrichment?.featuredAffiliateCardByProdTermUsid?.get(detail.prodTermUsid) ?? null;

    if (!termListing || termListing.prodOptionUsid !== item.prodOptionUsid) {
      return;
    }

    const offer = mapRentreListingItemToOffer(
      termListing,
      section,
      detail,
      detailFallback,
      featuredAffiliateCard,
      'list_api_by_term',
    );

    if (seenOfferIds.has(offer.externalOfferId)) {
      return;
    }

    seenOfferIds.add(offer.externalOfferId);
    offers.push(offer);
  });

  if (!seenOfferIds.has(`rentre:${item.prodOptionUsid}:${item.prodTermUsid}`)) {
    const currentTermDetail =
      proposalTerms.find((detail) => detail.prodTermUsid === item.prodTermUsid) ?? null;
    const featuredAffiliateCard =
      enrichment?.featuredAffiliateCardByProdTermUsid?.get(item.prodTermUsid) ?? null;
    const fallbackOffer = mapRentreListingItemToOffer(
      item,
      section,
      currentTermDetail,
      detailFallback,
      featuredAffiliateCard,
      'list_api_main',
    );
    offers.push(fallbackOffer);
  }

  return sortRentreOffers(offers);
}

function mapRentreItemToProduct(
  item: RentreProductListItemResponse,
  section: RentreListingSection,
  enrichment?: RentreCatalogEnrichment,
): RentreWaterPurifierProduct {
  const sections = [section] satisfies RentreListingSection[];
  const badges = collectBadgeTitles(item.prodBadgeResponse);
  const promoDurationMonths = resolvePromoDurationMonths(item);

  return {
    externalProductId: `rentre:${item.prodOptionUsid}`,
    prodOptionUsid: item.prodOptionUsid,
    prodUsid: item.prodUsid,
    brandName: item.brandKorean,
    productName: item.prodName,
    modelCode: item.prodOptionModelCode,
    detailUrl: createDetailUrl(item.prodOptionUsid),
    thumbnailUrl: item.prodOptionThumImgUrl,
    featureTags: extractFeatureTags(`${item.prodName} ${badges.join(' ')}`),
    metadata: {
      sections,
      badges,
      rating: toRating(item.prodReviewScoreCountResponse?.totalAvgScore),
      reviewCount: item.prodReviewScoreCountResponse?.totalCount ?? null,
      orderCount: item.contractCount,
      expectDiscountRate: item.expectDiscountRate,
      hasAffiliateCard: item.hasAfltnCard,
      affiliateCardDiscountAmount: item.afltnCardDisc,
      isHalfPricePromotion: item.minNowProjSubsPriceIsHalfPricePromotion,
      promoDurationMonths,
      postPromoMonthlyFee: item.originMinNowProjSubsPrice,
      brandCode: item.brand,
      rentalCompany: item.rentalCompany,
    },
    offers: resolveOffersForProduct(item, section, enrichment),
  };
}

function mergeProducts(
  existing: RentreWaterPurifierProduct,
  incoming: RentreWaterPurifierProduct,
): RentreWaterPurifierProduct {
  const mergedSections = mergeSections(existing.metadata.sections, incoming.metadata.sections);
  const mergedBadges = Array.from(new Set([...existing.metadata.badges, ...incoming.metadata.badges]));
  const offerMap = new Map<string, RentreWaterPurifierOffer>();

  [...existing.offers, ...incoming.offers].forEach((offer) => {
    const current = offerMap.get(offer.externalOfferId);

    if (!current) {
      offerMap.set(offer.externalOfferId, offer);
      return;
    }

    offerMap.set(offer.externalOfferId, {
      ...current,
      contractTermMonths: current.contractTermMonths ?? offer.contractTermMonths,
      managementType: current.managementType ?? offer.managementType,
      metadata: {
        ...current.metadata,
        sections: mergeSections(current.metadata.sections, offer.metadata.sections),
        obligationTermMonths:
          current.metadata.obligationTermMonths ?? offer.metadata.obligationTermMonths,
        ownershipTransferMonths:
          current.metadata.ownershipTransferMonths ??
          offer.metadata.ownershipTransferMonths,
        maintenanceCycleMonths:
          current.metadata.maintenanceCycleMonths ??
          offer.metadata.maintenanceCycleMonths,
        managementDiscoverySource:
          current.metadata.managementDiscoverySource === 'list_only'
            ? offer.metadata.managementDiscoverySource
            : current.metadata.managementDiscoverySource,
        managementTypeOptions: Array.from(
          new Set([
            ...current.metadata.managementTypeOptions,
            ...offer.metadata.managementTypeOptions,
          ]),
        ),
        promoTermHintMonths: Array.from(
          new Set([
            ...current.metadata.promoTermHintMonths,
            ...offer.metadata.promoTermHintMonths,
          ]),
        ).sort((left, right) => left - right),
        benefitHighlights: Array.from(
          new Set([
            ...current.metadata.benefitHighlights,
            ...offer.metadata.benefitHighlights,
          ]),
        ),
        cardNames: Array.from(
          new Set([...current.metadata.cardNames, ...offer.metadata.cardNames]),
        ),
        cardCompanies: Array.from(
          new Set([...current.metadata.cardCompanies, ...offer.metadata.cardCompanies]),
        ),
        cardImageUrl: current.metadata.cardImageUrl ?? offer.metadata.cardImageUrl,
      },
    });
  });

  return {
    ...existing,
    metadata: {
      ...existing.metadata,
      sections: mergedSections,
      badges: mergedBadges,
    },
    offers: sortRentreOffers(Array.from(offerMap.values())),
  };
}

export function mapRentreListingsToCatalog(
  mainListItems: readonly RentreProductListItemResponse[],
  newArrivalItems: readonly RentreProductListItemResponse[],
  pageTotalCount: number,
  fetchedAt: string = new Date().toISOString(),
  enrichment?: RentreCatalogEnrichment,
): RentreWaterPurifierCatalog {
  const productMap = new Map<string, RentreWaterPurifierProduct>();

  const addItems = (
    items: readonly RentreProductListItemResponse[],
    section: RentreListingSection,
  ): void => {
    items.forEach((item) => {
      const product = mapRentreItemToProduct(item, section, enrichment);
      const existing = productMap.get(product.externalProductId);

      if (!existing) {
        productMap.set(product.externalProductId, product);
        return;
      }

      productMap.set(product.externalProductId, mergeProducts(existing, product));
    });
  };

  addItems(mainListItems, 'main_list');
  addItems(newArrivalItems, 'new_arrivals');

  const products = Array.from(productMap.values());
  const offersCount = products.reduce((count, product) => count + product.offers.length, 0);

  return {
    fetchedAt,
    sourceUrl: RENTRE_WATER_PURIFIER_LIST_URL,
    sourceApiUrl: RENTRE_PRODUCT_LIST_URL,
    newArrivalApiUrl: RENTRE_NEW_PRODUCT_LIST_URL,
    pageTotalCount,
    mainListCount: mainListItems.length,
    newArrivalCount: newArrivalItems.length,
    productsCount: products.length,
    offersCount,
    products,
  };
}

export async function fetchRentreWaterPurifierPage(
  page: number,
  row: number = RENTRE_WATER_PURIFIER_PAGE_SIZE,
  fetchImpl: FetchLike = fetch,
): Promise<RentrePageResponse> {
  const response = await retryAsync(
    () =>
      fetchImpl(createRentreListUrl(page, row), {
        headers: createRequestHeaders(),
      }),
    {
      maxAttempts: DETAIL_FETCH_ATTEMPTS,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre product list: ${response.status}`);
  }

  return (await response.json()) as RentrePageResponse;
}

export async function fetchAllRentreWaterPurifierProducts(
  fetchImpl: FetchLike = fetch,
): Promise<{ items: RentreProductListItemResponse[]; pageTotalCount: number }> {
  const items: RentreProductListItemResponse[] = [];
  let page = 1;
  let pageTotalCount = 0;

  while (true) {
    const currentPage = await fetchRentreWaterPurifierPage(
      page,
      RENTRE_WATER_PURIFIER_PAGE_SIZE,
      fetchImpl,
    );

    items.push(...currentPage.data);
    pageTotalCount = currentPage.page.total;

    if (currentPage.page.lastPageYn || !currentPage.page.hasNextPage) {
      break;
    }

    page += 1;
  }

  return { items, pageTotalCount };
}

export async function fetchRentreNewWaterPurifierProducts(
  fetchImpl: FetchLike = fetch,
): Promise<RentreProductListItemResponse[]> {
  const response = await retryAsync(
    () =>
      fetchImpl(createRentreNewListUrl(), {
        headers: createRequestHeaders(),
      }),
    {
      maxAttempts: DETAIL_FETCH_ATTEMPTS,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre new product list: ${response.status}`);
  }

  return (await response.json()) as RentreProductListItemResponse[];
}

export async function fetchRentreProposalRequests(
  prodOptionUsid: number,
  fetchImpl: FetchLike = fetch,
): Promise<RentreProposalRequestResponseItem[]> {
  const response = await retryAsync(
    () =>
      fetchImpl(createRentreProposalListUrl(prodOptionUsid), {
        headers: createRequestHeaders(),
      }),
    {
      maxAttempts: DETAIL_FETCH_ATTEMPTS,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre proposal list: ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Unexpected Rentre proposal response: expected an array');
  }

  return parsed as RentreProposalRequestResponseItem[];
}

export async function fetchRentreProdTermListing(
  prodTermUsid: number,
  fetchImpl: FetchLike = fetch,
): Promise<RentreProductListItemResponse | null> {
  const response = await retryAsync(
    () =>
      fetchImpl(createRentreProdTermUrl(prodTermUsid), {
        headers: createRequestHeaders(),
      }),
    {
      maxAttempts: DETAIL_FETCH_ATTEMPTS,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre term listing: ${response.status}`);
  }

  const parsed = (await response.json()) as RentrePageResponse;
  return parsed.data.find((item) => item.prodTermUsid === prodTermUsid) ?? null;
}

export async function fetchRentreFeaturedAffiliateCard(
  prodTermUsid: number,
  fetchImpl: FetchLike = fetch,
): Promise<RentreFeaturedAffiliateCardResponse | null> {
  const response = await retryAsync(
    () =>
      fetchImpl(createRentreFeaturedAffiliateCardUrl(prodTermUsid), {
        headers: createRequestHeaders(),
      }),
    {
      maxAttempts: DETAIL_FETCH_ATTEMPTS,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Rentre featured affiliate card: ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;

  if (!parsed || typeof parsed !== 'object' || !('afltnCardUsid' in parsed)) {
    return null;
  }

  return parsed as RentreFeaturedAffiliateCardResponse;
}

async function fetchRentreProposalTermsByProdOption(
  prodOptionUsids: readonly number[],
  fetchImpl: FetchLike,
): Promise<Map<number, readonly RentreProposalTermDetail[]>> {
  const uniqueProdOptionUsids = Array.from(new Set(prodOptionUsids));
  const entries = await mapWithConcurrency(
    uniqueProdOptionUsids,
    DETAIL_ENRICHMENT_CONCURRENCY,
    async (prodOptionUsid) => {
      const proposals = await fetchRentreProposalRequests(prodOptionUsid, fetchImpl);
      return [prodOptionUsid, buildRentreProposalTermDetails(proposals)] as const;
    },
  );

  return new Map(entries);
}

async function fetchRentreTermListingsByProdTerm(
  prodTermUsids: readonly number[],
  fetchImpl: FetchLike,
): Promise<Map<number, RentreProductListItemResponse>> {
  const uniqueProdTermUsids = Array.from(new Set(prodTermUsids));
  const entries = await mapWithConcurrency(
    uniqueProdTermUsids,
    DETAIL_ENRICHMENT_CONCURRENCY,
    async (prodTermUsid) => {
      const listing = await fetchRentreProdTermListing(prodTermUsid, fetchImpl);
      return [prodTermUsid, listing] as const;
    },
  );

  const termMap = new Map<number, RentreProductListItemResponse>();

  entries.forEach(([prodTermUsid, listing]) => {
    if (!listing) {
      return;
    }

    termMap.set(prodTermUsid, listing);
  });

  return termMap;
}

async function fetchRentreFeaturedAffiliateCardsByProdTerm(
  items: readonly RentreProductListItemResponse[],
  termListingsByProdTermUsid: ReadonlyMap<number, RentreProductListItemResponse>,
  fetchImpl: FetchLike,
): Promise<Map<number, RentreFeaturedAffiliateCardResponse>> {
  const uniqueProdTermUsids = Array.from(
    new Set(
      [...items, ...Array.from(termListingsByProdTermUsid.values())]
        .filter((item) => item.hasAfltnCard)
        .map((item) => item.prodTermUsid),
    ),
  );

  const entries = await mapWithConcurrency(
    uniqueProdTermUsids,
    DETAIL_ENRICHMENT_CONCURRENCY,
    async (prodTermUsid) => {
      try {
        const featuredCard = await fetchRentreFeaturedAffiliateCard(prodTermUsid, fetchImpl);
        return [prodTermUsid, featuredCard] as const;
      } catch {
        return [prodTermUsid, null] as const;
      }
    },
  );

  return new Map(
    entries.filter(
      (entry): entry is readonly [number, RentreFeaturedAffiliateCardResponse] => entry[1] !== null,
    ),
  );
}

function shouldFetchDetailFallback(
  item: RentreProductListItemResponse,
  proposalTermsByProdOptionUsid: ReadonlyMap<number, readonly RentreProposalTermDetail[]>,
): boolean {
  const proposalTerms = proposalTermsByProdOptionUsid.get(item.prodOptionUsid) ?? [];
  const currentTermDetail =
    proposalTerms.find((detail) => detail.prodTermUsid === item.prodTermUsid) ?? null;

  return currentTermDetail === null || currentTermDetail.managementType === null;
}

async function fetchRentreDetailFallbackByProdOption(
  items: readonly RentreProductListItemResponse[],
  proposalTermsByProdOptionUsid: ReadonlyMap<number, readonly RentreProposalTermDetail[]>,
  fetchImpl: FetchLike,
): Promise<Map<number, RentreDetailFallback>> {
  const prodOptionUsidsNeedingFallback = Array.from(
    new Set(
      items
        .filter((item) => shouldFetchDetailFallback(item, proposalTermsByProdOptionUsid))
        .map((item) => item.prodOptionUsid),
    ),
  );

  const entries = await mapWithConcurrency(
    prodOptionUsidsNeedingFallback,
    DETAIL_ENRICHMENT_CONCURRENCY,
    async (prodOptionUsid) => {
      try {
        const html = await retryAsync(() => fetchRentreDetailHtml(prodOptionUsid, fetchImpl), {
          maxAttempts: DETAIL_FETCH_ATTEMPTS,
        });
        const detailPageData = parseRentreDetailPageData(html);

        if (!detailPageData) {
          return [prodOptionUsid, null] as const;
        }

        return [prodOptionUsid, buildRentreDetailFallback(detailPageData)] as const;
      } catch {
        return [prodOptionUsid, null] as const;
      }
    },
  );

  return new Map(
    entries.filter((entry): entry is readonly [number, RentreDetailFallback] => entry[1] !== null),
  );
}

export async function crawlRentreWaterPurifierCatalog(
  fetchImpl: FetchLike = fetch,
): Promise<RentreWaterPurifierCatalog> {
  const [{ items, pageTotalCount }, newArrivalItems] = await Promise.all([
    fetchAllRentreWaterPurifierProducts(fetchImpl),
    fetchRentreNewWaterPurifierProducts(fetchImpl),
  ]);

  const prodOptionUsids = [...items, ...newArrivalItems].map((item) => item.prodOptionUsid);
  const proposalTermsByProdOptionUsid = await fetchRentreProposalTermsByProdOption(
    prodOptionUsids,
    fetchImpl,
  );
  const prodTermUsids = Array.from(proposalTermsByProdOptionUsid.values()).flatMap((terms) =>
    terms.map((term) => term.prodTermUsid),
  );
  const termListingsByProdTermUsid = await fetchRentreTermListingsByProdTerm(
    prodTermUsids,
    fetchImpl,
  );
  const featuredAffiliateCardByProdTermUsid = await fetchRentreFeaturedAffiliateCardsByProdTerm(
    [...items, ...newArrivalItems],
    termListingsByProdTermUsid,
    fetchImpl,
  );
  const detailFallbackByProdOptionUsid = await fetchRentreDetailFallbackByProdOption(
    [...items, ...newArrivalItems],
    proposalTermsByProdOptionUsid,
    fetchImpl,
  );

  return mapRentreListingsToCatalog(items, newArrivalItems, pageTotalCount, new Date().toISOString(), {
    proposalTermsByProdOptionUsid,
    termListingsByProdTermUsid,
    detailFallbackByProdOptionUsid,
    featuredAffiliateCardByProdTermUsid,
  });
}

async function main(): Promise<void> {
  const catalog = await crawlRentreWaterPurifierCatalog();
  console.log(JSON.stringify(catalog, null, 2));
}

if (require.main === module) {
  void main();
}
