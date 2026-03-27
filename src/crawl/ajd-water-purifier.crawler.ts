import { ManagementType, SupportPricingModel } from '../comparison/comparison.types';

const AJD_BASE_URL = 'https://www.ajd.co.kr';
export const AJD_WATER_PURIFIER_RANKING_URL =
  `${AJD_BASE_URL}/electronics/overview/2010-4020/ranking?tab=1`;
const AJD_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

type FetchLike = typeof fetch;
type AjdNuxtPayload = unknown[];

interface AjdResolvedNuxtRoot {
  data?: Record<string, unknown>;
}

interface AjdRankingPayloadProduct {
  sn: number;
  lowerCategorySn: number;
  rankingNumber: number | null;
  brandName: string;
  name: string;
  modelName: string;
}

interface AjdDetailCard {
  name: string | null;
  discountAmount: number | null;
}

interface AjdDetailChargeOption {
  sn: number | null;
  companyName: string | null;
  contractTermMonths: number | null;
  managementLabel: string | null;
  managementCycle: string | null;
  rawManagementType: string | null;
  publicMonthlyFee: number | null;
  installCharge: number | null;
}

interface AjdDetailPayload {
  detailSn: number | null;
  lowerCategorySn: number | null;
  reviewCount: number | null;
  averageScore: number | null;
  recommendLabel: string | null;
  chargeOptions: AjdDetailChargeOption[];
  cards: AjdDetailCard[];
}

export interface AjdWaterPurifierOffer {
  externalOfferId: string;
  offerName: string;
  publicOfferUrl: string;
  managementType: ManagementType | null;
  contractTermMonths: number | null;
  publicMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  metadata: {
    rankingRank: number | null;
    benefitEvidence: 'not_exposed_in_ranking' | 'not_exposed_in_detail';
    managementCycle?: string | null;
    companyName?: string | null;
    installCharge?: number | null;
    rawManagementType?: string | null;
    cardDiscountAmount?: number | null;
  };
}

export interface AjdWaterPurifierProduct {
  externalProductId: string;
  rankingRank: number | null;
  brandName: string;
  productName: string;
  modelCode: string;
  detailUrl: string;
  thumbnailUrl: string | null;
  featureTags: string[];
  metadata: {
    totalScore: number | null;
    reviewCount: number | null;
    textBadges: string[];
    specifications: Record<string, string>;
    scoreBreakdown: Record<string, number>;
    detailSn?: number | null;
    lowerCategorySn?: number | null;
    detailAverageScore?: number | null;
    recommendLabel?: string | null;
  };
  offers: AjdWaterPurifierOffer[];
}

export interface AjdWaterPurifierCatalog {
  fetchedAt: string;
  sourceUrl: string;
  pageTitle: string | null;
  rankingLabel: string;
  pageTotalCount: number | null;
  productsCount: number;
  offersCount: number;
  products: AjdWaterPurifierProduct[];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value.replace(/<!--\[-->|<!--\]-->/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d.]/g, '');
  if (!digits) {
    return null;
  }

  return Number(digits);
}

function parseWon(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  return Number(digits);
}

function captureOne(block: string, pattern: RegExp): string | null {
  const match = block.match(pattern);
  return match?.[1] ? normalizeText(match[1]) : null;
}

function captureAll(block: string, pattern: RegExp): string[] {
  return Array.from(block.matchAll(pattern))
    .map((match) => normalizeText(match[1] ?? ''))
    .filter((value) => value.length > 0);
}

function parseSpecifications(block: string): Record<string, string> {
  const specifications: Record<string, string> = {};

  for (const match of block.matchAll(
    /<div class="spec-list"><span>([^<]+)<\/span><p>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<\/p><\/div>/g,
  )) {
    const label = normalizeText(match[1]);
    const value = normalizeText(match[2]);

    if (label.length > 0) {
      specifications[label] = value;
    }
  }

  return specifications;
}

function parseScoreBreakdown(block: string): Record<string, number> {
  const scoreBreakdown: Record<string, number> = {};

  for (const match of block.matchAll(
    /<div class="score-option"[^>]*><span class="label"[^>]*>([^<]+)<\/span><span class="[^"]*value score-dot"[^>]*>([\d.]+)<\/span><\/div>/g,
  )) {
    const label = normalizeText(match[1]);
    const value = Number(match[2]);

    if (label.length > 0 && !Number.isNaN(value)) {
      scoreBreakdown[label] = value;
    }
  }

  return scoreBreakdown;
}

export function extractAjdRankingItemBlocks(html: string): string[] {
  const sectionMatch = html.match(
    /<section class="ranking-list-section" id="ranking-list-section">([\s\S]*?)<\/section>/,
  );
  const rankingSection = sectionMatch?.[1] ?? html;

  return rankingSection
    .split('<div class="item ranking-list-item">')
    .slice(1)
    .map((segment) => segment.split('<div class="ranking-divider"></div></div>')[0] ?? segment)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function mapAjdRankingItem(block: string): AjdWaterPurifierProduct {
  const rankingRank = parseNumber(captureOne(block, /ranking-badge">(\d+)</));
  const brandName = captureOne(block, /<div class="brand">([^<]+)<\/div>/) ?? '';
  const productName = captureOne(block, /<div class="name">([^<]+)<\/div>/) ?? '';
  const modelCode = captureOne(block, /<small class="detail-name">([^<]+)<\/small>/) ?? '';
  const imageUrl = captureOne(block, /<img src="([^"]+)" alt="[^"]+" loading="lazy" class="">/);
  const totalScore = parseNumber(captureOne(block, /종합점수<\/small><br[^>]*>([\d.]+)/));
  const publicMonthlyFee = parseWon(
    captureOne(block, /<p class="product-price-box__monthly"[^>]*>([^<]+)<\/p>/),
  );
  const cardAppliedMonthlyFee = parseWon(
    captureOne(block, /<p class="product-price-box__card-discount"[^>]*>[\s\S]*?월 ([\d,]+)원<\/p>/),
  );
  const reviewCount = parseWon(
    captureOne(
      block,
      /<p class="review"><span class="label">구매 후기 <\/span><span class="value">([\d,]+)건<\/span><\/p>/,
    ),
  );
  const featureTags = captureAll(
    block,
    /<div class="purifier-type[^"]*"><span class="icon"><\/span><span class="value">([^<]+)<\/span><\/div>/g,
  );
  const textBadges = captureAll(
    block,
    /<div class="product-text-badge row">[\s\S]*?<span>([^<]+)<\/span>/g,
  );
  const offerName = `${brandName} ${productName}`.trim();

  const offer: AjdWaterPurifierOffer = {
    externalOfferId: `ajd:${modelCode}:rank:${rankingRank ?? 'unknown'}`,
    offerName,
    publicOfferUrl: AJD_WATER_PURIFIER_RANKING_URL,
    managementType: null,
    contractTermMonths: null,
    publicMonthlyFee,
    cardAppliedMonthlyFee,
    supportPricingModel: 'hidden',
    supportAmount: null,
    supportAmountMin: null,
    supportAmountMax: null,
    metadata: {
      rankingRank,
      benefitEvidence: 'not_exposed_in_ranking',
    },
  };

  return {
    externalProductId: `ajd:${modelCode || rankingRank || productName}`,
    rankingRank,
    brandName,
    productName,
    modelCode,
    detailUrl: AJD_WATER_PURIFIER_RANKING_URL,
    thumbnailUrl: imageUrl,
    featureTags,
    metadata: {
      totalScore,
      reviewCount,
      textBadges,
      specifications: parseSpecifications(block),
      scoreBreakdown: parseScoreBreakdown(block),
    },
    offers: [offer],
  };
}

function extractAjdNuxtPayloadScript(html: string): string | null {
  const match = html.match(/<script[^>]*data-nuxt-data[^>]*>([\s\S]*?)<\/script>/);
  return match?.[1] ?? null;
}

function parseAjdNuxtPayload(html: string): AjdNuxtPayload | null {
  const rawPayload = extractAjdNuxtPayloadScript(html);

  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as AjdNuxtPayload;
    return Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

function createAjdNuxtPayloadResolver(payload: AjdNuxtPayload) {
  const cache = new Map<number, unknown>();
  const resolving = new Set<number>();

  function resolveReference(index: number): unknown {
    if (cache.has(index)) {
      return cache.get(index);
    }

    if (resolving.has(index)) {
      return null;
    }

    resolving.add(index);

    const raw = payload[index];
    let resolved: unknown;

    if (Array.isArray(raw)) {
      const [tag, ...rest] = raw;

      if (tag === 'ShallowReactive' || tag === 'Reactive' || tag === 'Ref') {
        resolved = resolveValue(rest[0]);
      } else if (tag === 'EmptyRef') {
        resolved = null;
      } else {
        resolved = raw.map((item) => resolveValue(item));
      }
    } else if (raw && typeof raw === 'object') {
      resolved = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, resolveValue(value)]),
      );
    } else {
      resolved = raw;
    }

    resolving.delete(index);
    cache.set(index, resolved);

    return resolved;
  }

  function resolveValue(value: unknown): unknown {
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < payload.length
    ) {
      return resolveReference(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => resolveValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, resolveValue(child)]),
      );
    }

    return value;
  }

  return {
    resolveReference,
  };
}

function resolveAjdNuxtRoot(html: string): AjdResolvedNuxtRoot | null {
  const payload = parseAjdNuxtPayload(html);

  if (!payload || payload.length === 0) {
    return null;
  }

  const rootReference = Array.isArray(payload[0]) && typeof payload[0][1] === 'number' ? payload[0][1] : 1;
  const resolver = createAjdNuxtPayloadResolver(payload);
  const root = resolver.resolveReference(rootReference);

  if (!root || typeof root !== 'object') {
    return null;
  }

  return root as AjdResolvedNuxtRoot;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildAjdDetailUrl(lowerCategorySn: number, detailSn: number): string {
  return `${AJD_BASE_URL}/electronics/overview/${lowerCategorySn}/detail/${detailSn}`;
}

function buildAjdRankingLookupKey(product: {
  modelName: string;
  brandName: string;
  name: string;
}): string {
  return [product.brandName, product.name, product.modelName].join('::');
}

export function parseAjdRankingPayloadProducts(html: string): AjdRankingPayloadProduct[] {
  const root = resolveAjdNuxtRoot(html);
  const rankingList = root?.data?.['rental-ranking-list'];

  if (!rankingList || typeof rankingList !== 'object') {
    return [];
  }

  const content = (rankingList as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const rankingProduct = item as Record<string, unknown>;
      const sn = toNumberOrNull(rankingProduct.sn);
      const lowerCategorySn = toNumberOrNull(rankingProduct.lowerCategorySn);
      const modelName = toStringOrNull(rankingProduct.modelName);
      const brandName = toStringOrNull(rankingProduct.brandName);
      const name = toStringOrNull(rankingProduct.name);

      if (!sn || !lowerCategorySn || !modelName || !brandName || !name) {
        return null;
      }

      return {
        sn,
        lowerCategorySn,
        rankingNumber: toNumberOrNull(rankingProduct.rankingNumber),
        name,
        modelName,
        brandName,
      } satisfies AjdRankingPayloadProduct;
    })
    .filter((product): product is AjdRankingPayloadProduct => product !== null);
}

function normalizeAjdManagementType(
  rawManagementType: string | null,
  managementLabel: string | null,
): ManagementType | null {
  const source = `${rawManagementType ?? ''} ${managementLabel ?? ''}`.toLowerCase();

  if (source.includes('none') || source.includes('관리없음') || source.includes('self') || source.includes('셀프')) {
    return 'self';
  }

  if (source.length === 0) {
    return null;
  }

  return 'visit';
}

function dedupeAjdDetailChargeOptions(
  options: AjdDetailChargeOption[],
): AjdDetailChargeOption[] {
  const deduped = new Map<string, AjdDetailChargeOption>();

  options.forEach((option) => {
    const key = [
      option.sn ?? 'unknown',
      option.contractTermMonths ?? 'unknown',
      option.managementLabel ?? 'unknown',
      option.managementCycle ?? 'unknown',
    ].join('::');

    if (!deduped.has(key)) {
      deduped.set(key, option);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTerm = left.contractTermMonths ?? Number.MAX_SAFE_INTEGER;
    const rightTerm = right.contractTermMonths ?? Number.MAX_SAFE_INTEGER;

    if (leftTerm !== rightTerm) {
      return leftTerm - rightTerm;
    }

    return (left.managementLabel ?? '').localeCompare(right.managementLabel ?? '', 'ko-KR');
  });
}

export function parseAjdDetailPayload(html: string): AjdDetailPayload | null {
  const root = resolveAjdNuxtRoot(html);
  const detailEntry = Object.entries(root?.data ?? {}).find(
    ([key, value]) =>
      key.startsWith('rental-detail-') &&
      value &&
      typeof value === 'object' &&
      'chargeList' in (value as Record<string, unknown>),
  )?.[1] as Record<string, unknown> | undefined;

  if (!detailEntry) {
    return null;
  }

  const chargeGroups = Array.isArray(detailEntry.chargeList) ? detailEntry.chargeList : [];
  const chargeOptions = chargeGroups.flatMap((chargeGroup) => {
    if (!chargeGroup || typeof chargeGroup !== 'object') {
      return [];
    }

    const contractTermMonths = toNumberOrNull(
      (chargeGroup as Record<string, unknown>).contractPeriod,
    );
    const managementGroups = Array.isArray((chargeGroup as Record<string, unknown>).children)
      ? ((chargeGroup as Record<string, unknown>).children as unknown[])
      : [];

    return managementGroups.flatMap((managementGroup) => {
      if (!managementGroup || typeof managementGroup !== 'object') {
        return [];
      }

      const managementLabel = toStringOrNull((managementGroup as Record<string, unknown>).name);
      const managementCycles = Array.isArray((managementGroup as Record<string, unknown>).children)
        ? ((managementGroup as Record<string, unknown>).children as unknown[])
        : [];

      return managementCycles
        .map((managementCycle) => {
          if (!managementCycle || typeof managementCycle !== 'object') {
            return null;
          }

          const cycle = managementCycle as Record<string, unknown>;

          return {
            sn: toNumberOrNull(cycle.sn),
            companyName: toStringOrNull(cycle.companyName),
            contractTermMonths: toNumberOrNull(cycle.contractPeriod) ?? contractTermMonths,
            managementLabel,
            managementCycle:
              toStringOrNull(cycle.managementCycle) ?? toStringOrNull(cycle.name),
            rawManagementType: toStringOrNull(cycle.managementType),
            publicMonthlyFee: toNumberOrNull(cycle.firstCharge),
            installCharge: toNumberOrNull(cycle.installCharge),
          } satisfies AjdDetailChargeOption;
        })
        .filter((option): option is AjdDetailChargeOption => option !== null);
    });
  });

  const cards = (Array.isArray(detailEntry.cardList) ? detailEntry.cardList : [])
    .map((card) => {
      if (!card || typeof card !== 'object') {
        return null;
      }

      const normalizedCard = card as Record<string, unknown>;

      return {
        name: toStringOrNull(normalizedCard.name),
        discountAmount: toNumberOrNull(normalizedCard.discountAmount),
      } satisfies AjdDetailCard;
    })
    .filter((card): card is AjdDetailCard => card !== null);

  return {
    detailSn: toNumberOrNull(detailEntry.sn),
    lowerCategorySn: toNumberOrNull(detailEntry.lowerCategorySn),
    reviewCount: toNumberOrNull(detailEntry.reviewCount),
    averageScore: toNumberOrNull(detailEntry.averageScore),
    recommendLabel: toStringOrNull(detailEntry.recommendLabel),
    chargeOptions: dedupeAjdDetailChargeOptions(chargeOptions),
    cards,
  };
}

function resolveAjdMaxCardDiscountAmount(cards: AjdDetailCard[]): number | null {
  const discounts = cards
    .map((card) => card.discountAmount)
    .filter((discount): discount is number => discount !== null);

  if (discounts.length === 0) {
    return null;
  }

  return Math.max(...discounts);
}

function attachAjdDetailUrl(
  product: AjdWaterPurifierProduct,
  detailUrl: string,
  detailSn: number | null,
  lowerCategorySn: number | null,
): AjdWaterPurifierProduct {
  return {
    ...product,
    detailUrl,
    metadata: {
      ...product.metadata,
      detailSn,
      lowerCategorySn,
    },
    offers: product.offers.map((offer) => ({
      ...offer,
      publicOfferUrl: detailUrl,
    })),
  };
}

export function mergeAjdProductWithDetailPayload(
  product: AjdWaterPurifierProduct,
  detailPayload: AjdDetailPayload,
): AjdWaterPurifierProduct {
  const detailUrl =
    detailPayload.detailSn && detailPayload.lowerCategorySn
      ? buildAjdDetailUrl(detailPayload.lowerCategorySn, detailPayload.detailSn)
      : product.detailUrl;
  const productWithDetailUrl = attachAjdDetailUrl(
    product,
    detailUrl,
    detailPayload.detailSn,
    detailPayload.lowerCategorySn,
  );
  const cardDiscountAmount = resolveAjdMaxCardDiscountAmount(detailPayload.cards);

  if (detailPayload.chargeOptions.length === 0) {
    return {
      ...productWithDetailUrl,
      metadata: {
        ...productWithDetailUrl.metadata,
        reviewCount: detailPayload.reviewCount ?? productWithDetailUrl.metadata.reviewCount,
        detailAverageScore: detailPayload.averageScore,
        recommendLabel: detailPayload.recommendLabel,
      },
    };
  }

  const offers = detailPayload.chargeOptions.map((option) => {
    const managementType = normalizeAjdManagementType(
      option.rawManagementType,
      option.managementLabel,
    );

    return {
      externalOfferId: `ajd:${detailPayload.detailSn ?? product.modelCode}:${option.sn ?? `${option.contractTermMonths ?? 'na'}:${option.managementLabel ?? 'na'}`}`,
      offerName: [
        product.brandName,
        product.productName,
        option.contractTermMonths ? `${option.contractTermMonths}개월` : null,
        option.managementLabel,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' '),
      publicOfferUrl: detailUrl,
      managementType,
      contractTermMonths: option.contractTermMonths,
      publicMonthlyFee: option.publicMonthlyFee,
      cardAppliedMonthlyFee:
        option.publicMonthlyFee !== null && cardDiscountAmount !== null
          ? Math.max(option.publicMonthlyFee - cardDiscountAmount, 0)
          : null,
      supportPricingModel: 'hidden',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
      metadata: {
        rankingRank: product.rankingRank,
        benefitEvidence: 'not_exposed_in_detail',
        managementCycle: option.managementCycle,
        companyName: option.companyName,
        installCharge: option.installCharge,
        rawManagementType: option.rawManagementType,
        cardDiscountAmount,
      },
    } satisfies AjdWaterPurifierOffer;
  });

  return {
    ...productWithDetailUrl,
    metadata: {
      ...productWithDetailUrl.metadata,
      reviewCount: detailPayload.reviewCount ?? productWithDetailUrl.metadata.reviewCount,
      detailAverageScore: detailPayload.averageScore,
      recommendLabel: detailPayload.recommendLabel,
    },
    offers,
  };
}

export function parseAjdRankingCatalog(
  html: string,
  fetchedAt: string = new Date().toISOString(),
): AjdWaterPurifierCatalog {
  const itemBlocks = extractAjdRankingItemBlocks(html);
  const products = itemBlocks.map((block) => mapAjdRankingItem(block));
  const pageTitle = captureOne(html, /<title>([^<]+)<\/title>/);
  const pageTotalCount = parseNumber(
    captureOne(html, /<p class="total-amount">\s*총 <span class="value">(\d+)<\/span>\s*건\s*<\/p>/),
  );

  return {
    fetchedAt,
    sourceUrl: AJD_WATER_PURIFIER_RANKING_URL,
    pageTitle,
    rankingLabel: '종합점수',
    pageTotalCount,
    productsCount: products.length,
    offersCount: products.reduce((count, product) => count + product.offers.length, 0),
    products,
  };
}

function buildAjdRankingPageUrl(page: number): string {
  const url = new URL(AJD_WATER_PURIFIER_RANKING_URL);

  if (page > 1) {
    url.searchParams.set('page', String(page));
  } else {
    url.searchParams.delete('page');
  }

  return url.toString();
}

export async function fetchAjdWaterPurifierRankingHtml(
  fetchImpl: FetchLike = fetch,
  page: number = 1,
): Promise<string> {
  const response = await fetchImpl(buildAjdRankingPageUrl(page), {
    headers: {
      'user-agent': AJD_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AJD ranking page: ${response.status}`);
  }

  return response.text();
}

export async function fetchAjdWaterPurifierDetailHtml(
  detailUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const response = await fetchImpl(detailUrl, {
    headers: {
      'user-agent': AJD_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AJD detail page: ${response.status}`);
  }

  return response.text();
}

export async function crawlAjdWaterPurifierCatalog(
  fetchImpl: FetchLike = fetch,
): Promise<AjdWaterPurifierCatalog> {
  const firstPageHtml = await fetchAjdWaterPurifierRankingHtml(fetchImpl, 1);
  const firstPageCatalog = parseAjdRankingCatalog(firstPageHtml);
  const pageSize = Math.max(firstPageCatalog.products.length, 1);
  const totalPages = Math.max(
    1,
    Math.ceil((firstPageCatalog.pageTotalCount ?? firstPageCatalog.products.length) / pageSize),
  );

  const allProducts: AjdWaterPurifierProduct[] = [...firstPageCatalog.products];
  const allRankingPayloadProducts: AjdRankingPayloadProduct[] = [
    ...parseAjdRankingPayloadProducts(firstPageHtml),
  ];

  for (let page = 2; page <= totalPages; page += 1) {
    try {
      const pageHtml = await fetchAjdWaterPurifierRankingHtml(fetchImpl, page);
      const pageCatalog = parseAjdRankingCatalog(pageHtml);
      allProducts.push(...pageCatalog.products);
      allRankingPayloadProducts.push(...parseAjdRankingPayloadProducts(pageHtml));
    } catch {
      break;
    }
  }

  const dedupedProducts = allProducts;
  const rankingPayloadProducts = Array.from(
    new Map(
      allRankingPayloadProducts.map((product) => [
        `${product.lowerCategorySn}:${product.sn}:${product.modelName}`,
        product,
      ]),
    ).values(),
  );
  const rankingPayloadMap = new Map(
    rankingPayloadProducts.map((product) => [buildAjdRankingLookupKey(product), product]),
  );

  const products = await Promise.all(
    dedupedProducts.map(async (product) => {
      const rankingPayloadProduct =
        rankingPayloadMap.get(
          buildAjdRankingLookupKey({
            brandName: product.brandName,
            name: product.productName,
            modelName: product.modelCode,
          }),
        ) ??
        rankingPayloadProducts.find((candidate) => candidate.modelName === product.modelCode);

      if (!rankingPayloadProduct) {
        return product;
      }

      const detailUrl = buildAjdDetailUrl(
        rankingPayloadProduct.lowerCategorySn,
        rankingPayloadProduct.sn,
      );
      const productWithDetailUrl = attachAjdDetailUrl(
        product,
        detailUrl,
        rankingPayloadProduct.sn,
        rankingPayloadProduct.lowerCategorySn,
      );

      try {
        const detailHtml = await fetchAjdWaterPurifierDetailHtml(detailUrl, fetchImpl);
        const detailPayload = parseAjdDetailPayload(detailHtml);

        if (!detailPayload) {
          return productWithDetailUrl;
        }

        return mergeAjdProductWithDetailPayload(productWithDetailUrl, detailPayload);
      } catch {
        return productWithDetailUrl;
      }
    }),
  );

  return {
    ...firstPageCatalog,
    products,
    productsCount: products.length,
    offersCount: products.reduce((count, product) => count + product.offers.length, 0),
  };
}

async function main(): Promise<void> {
  const catalog = await crawlAjdWaterPurifierCatalog();
  console.log(JSON.stringify(catalog, null, 2));
}

if (require.main === module) {
  void main();
}
