import { ManagementType, SupportPricingModel } from '../comparison/comparison.types';

export const MISO_WATER_PURIFIER_LIST_URL = 'https://miso.kr/booking/rental/water_purifier';
export const MISO_DIRECTORY_GOODS_URL =
  'https://www.getmiso.com//lambdaro/public/directory-v1-get-goods';

type FetchLike = typeof fetch;

interface MisoDirectoryRequest {
  filter: {
    goods_type: 'water_purifier';
    good_values: Record<string, string>;
    stock_values: Record<string, string>;
  };
}

export interface MisoDirectoryGoodsResponse {
  id: number;
  brand: string;
  goods_code: string;
  goods_type: string;
  name: string;
  popularity: number;
  rank_info?: {
    tag?: string | null;
    rank?: number | null;
    description?: string | null;
  } | null;
  values?: {
    color_info?: Array<{
      color_code?: string | null;
      color_name?: string | null;
    }> | null;
    form_factor?: string | null;
    filter_method?: string | null;
    purification_type?: string | null;
    purifier_functions?: string | null;
  } | null;
  thumbnails?: Array<{
    id: number;
    goods_id: number;
    url: string;
    index: number;
    type: string;
  }> | null;
  images?: Array<{
    id: number;
    goods_id: number;
    url: string;
    index: number;
    type: string;
  }> | null;
  stocks?: MisoStockResponse[] | null;
}

export interface MisoStockResponse {
  id: number;
  goods_id: number;
  serial: string;
  product_name: string;
  is_recommended: boolean;
  values?: {
    payback?: {
      cash?: number | null;
    } | null;
    color_code?: string | null;
    monthly_fee?: number | null;
    card_discount?: number | null;
    rental_period?: number | null;
    maintenance_type?: string | null;
    commitment_period?: number | null;
    maintenance_period?: number | null;
  } | null;
}

export interface MisoWaterPurifierOffer {
  externalOfferId: string;
  stockId: number;
  serial: string;
  offerName: string;
  publicOfferUrl: string;
  managementType: ManagementType | null;
  contractTermMonths: number | null;
  publicMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  cardDiscountAmount: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  metadata: {
    maintenancePeriodMonths: number | null;
    commitmentPeriodMonths: number | null;
    isRecommended: boolean;
    colorCode: string | null;
    benefitEvidence: 'api_payback' | 'consult_required_copy';
  };
}

export interface MisoWaterPurifierProduct {
  externalProductId: string;
  goodsId: number;
  goodsCode: string;
  brandName: string;
  productName: string;
  modelCode: string;
  detailUrl: string;
  thumbnailUrl: string | null;
  detailImageUrl: string | null;
  featureTags: string[];
  metadata: {
    popularity: number;
    listingRank: number | null;
    listingTag: string | null;
    listingDescription: string | null;
    formFactor: string | null;
    purificationType: string | null;
    purifierFunctionsRaw: string | null;
    filterMethod: string | null;
    colorNames: string[];
  };
  offers: MisoWaterPurifierOffer[];
}

export interface MisoWaterPurifierCatalog {
  fetchedAt: string;
  sourceUrl: string;
  sourceApiUrl: string;
  productsCount: number;
  offersCount: number;
  products: MisoWaterPurifierProduct[];
}

interface MisoNextPageProps {
  rentalRecommendProducts?: MisoDirectoryGoodsResponse[];
  filterOptions?: unknown;
  meta?: unknown;
}

interface SupportPricingResolution {
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  benefitEvidence: 'api_payback' | 'consult_required_copy';
}

function createDirectoryRequest(): MisoDirectoryRequest {
  return {
    filter: {
      goods_type: 'water_purifier',
      good_values: {},
      stock_values: {},
    },
  };
}

function parseFeatureTags(rawValue: string | null | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  const tokens = rawValue
    .split(/[^가-힣A-Za-z0-9]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const mapping: Array<{ pattern: string; tags: string[] }> = [
    { pattern: '얼음', tags: ['얼음'] },
    { pattern: '냉', tags: ['냉수'] },
    { pattern: '온', tags: ['온수'] },
    { pattern: '정', tags: ['정수'] },
  ];

  const resolvedTags = new Set<string>();

  for (const token of tokens) {
    for (const candidate of mapping) {
      if (token.includes(candidate.pattern)) {
        candidate.tags.forEach((tag) => resolvedTags.add(tag));
      }
    }
  }

  return Array.from(resolvedTags);
}

function toManagementType(rawValue: string | null | undefined): ManagementType | null {
  if (rawValue === 'visit' || rawValue === 'self') {
    return rawValue;
  }

  return null;
}

function calculateCardAppliedMonthlyFee(
  monthlyFee: number | null | undefined,
  cardDiscount: number | null | undefined,
): number | null {
  if (monthlyFee === null || monthlyFee === undefined) {
    return null;
  }

  if (cardDiscount === null || cardDiscount === undefined) {
    return null;
  }

  return Math.max(monthlyFee - cardDiscount, 0);
}

function resolveSupportPricing(paybackCash: number | null | undefined): SupportPricingResolution {
  if (typeof paybackCash === 'number' && paybackCash > 0) {
    return {
      supportPricingModel: 'fixed_public',
      supportAmount: paybackCash,
      supportAmountMin: null,
      supportAmountMax: null,
      benefitEvidence: 'api_payback',
    };
  }

  return {
    supportPricingModel: 'quote_required',
    supportAmount: null,
    supportAmountMin: null,
    supportAmountMax: null,
    benefitEvidence: 'consult_required_copy',
  };
}

function buildMisoDetailUrl(goodsCode: string): string {
  return `${MISO_WATER_PURIFIER_LIST_URL}/${encodeURIComponent(goodsCode)}`;
}

function pickThumbnailUrl(goods: MisoDirectoryGoodsResponse): string | null {
  const thumbnail = (goods.thumbnails ?? []).slice().sort((left, right) => left.index - right.index)[0];
  return thumbnail?.url ?? null;
}

function pickDetailImageUrl(goods: MisoDirectoryGoodsResponse): string | null {
  const image = (goods.images ?? []).slice().sort((left, right) => left.index - right.index)[0];
  return image?.url ?? null;
}

function mapStockToOffer(
  goods: MisoDirectoryGoodsResponse,
  stock: MisoStockResponse,
): MisoWaterPurifierOffer {
  const monthlyFee = stock.values?.monthly_fee ?? null;
  const cardDiscount = stock.values?.card_discount ?? null;
  const supportPricing = resolveSupportPricing(stock.values?.payback?.cash ?? null);

  return {
    externalOfferId: `miso:${goods.id}:${stock.id}`,
    stockId: stock.id,
    serial: stock.serial,
    offerName: `${goods.brand} ${goods.name}`.trim(),
    publicOfferUrl: buildMisoDetailUrl(goods.goods_code),
    managementType: toManagementType(stock.values?.maintenance_type),
    contractTermMonths: stock.values?.rental_period ?? null,
    publicMonthlyFee: monthlyFee,
    cardAppliedMonthlyFee: calculateCardAppliedMonthlyFee(monthlyFee, cardDiscount),
    cardDiscountAmount: cardDiscount,
    supportPricingModel: supportPricing.supportPricingModel,
    supportAmount: supportPricing.supportAmount,
    supportAmountMin: supportPricing.supportAmountMin,
    supportAmountMax: supportPricing.supportAmountMax,
    metadata: {
      maintenancePeriodMonths: stock.values?.maintenance_period ?? null,
      commitmentPeriodMonths: stock.values?.commitment_period ?? null,
      isRecommended: stock.is_recommended,
      colorCode: stock.values?.color_code ?? null,
      benefitEvidence: supportPricing.benefitEvidence,
    },
  };
}

export function mapMisoGoodsToCatalog(
  goodsList: readonly MisoDirectoryGoodsResponse[],
  fetchedAt: string = new Date().toISOString(),
): MisoWaterPurifierCatalog {
  const products = goodsList
    .filter((goods) => goods.goods_type === 'water_purifier')
    .map<MisoWaterPurifierProduct>((goods) => ({
      externalProductId: `miso:${goods.id}`,
      goodsId: goods.id,
      goodsCode: goods.goods_code,
      brandName: goods.brand,
      productName: goods.name,
      modelCode: goods.goods_code,
      detailUrl: buildMisoDetailUrl(goods.goods_code),
      thumbnailUrl: pickThumbnailUrl(goods),
      detailImageUrl: pickDetailImageUrl(goods),
      featureTags: parseFeatureTags(goods.values?.purifier_functions),
      metadata: {
        popularity: goods.popularity,
        listingRank: goods.rank_info?.rank ?? null,
        listingTag: goods.rank_info?.tag ?? null,
        listingDescription: goods.rank_info?.description ?? null,
        formFactor: goods.values?.form_factor ?? null,
        purificationType: goods.values?.purification_type ?? null,
        purifierFunctionsRaw: goods.values?.purifier_functions ?? null,
        filterMethod: goods.values?.filter_method ?? null,
        colorNames: (goods.values?.color_info ?? [])
          .map((color) => color.color_name?.trim() ?? '')
          .filter((value) => value.length > 0),
      },
      offers: (goods.stocks ?? []).map((stock) => mapStockToOffer(goods, stock)),
    }));

  return {
    fetchedAt,
    sourceUrl: MISO_WATER_PURIFIER_LIST_URL,
    sourceApiUrl: MISO_DIRECTORY_GOODS_URL,
    productsCount: products.length,
    offersCount: products.reduce((count, product) => count + product.offers.length, 0),
    products,
  };
}

export function extractMisoNextPageProps(html: string): MisoNextPageProps {
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );

  if (!nextDataMatch) {
    throw new Error('Miso listing page does not contain __NEXT_DATA__');
  }

  const parsed = JSON.parse(nextDataMatch[1]) as {
    props?: {
      pageProps?: MisoNextPageProps;
    };
  };

  return parsed.props?.pageProps ?? {};
}

export async function fetchMisoListingHtml(fetchImpl: FetchLike = fetch): Promise<string> {
  const response = await fetchImpl(MISO_WATER_PURIFIER_LIST_URL, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Miso listing page: ${response.status}`);
  }

  return response.text();
}

export async function fetchMisoDirectoryGoods(
  fetchImpl: FetchLike = fetch,
): Promise<MisoDirectoryGoodsResponse[]> {
  const response = await fetchImpl(MISO_DIRECTORY_GOODS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(createDirectoryRequest()),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Miso directory goods: ${response.status}`);
  }

  const parsed = (await response.json()) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Unexpected Miso directory response: expected an array');
  }

  return parsed as MisoDirectoryGoodsResponse[];
}

export async function crawlMisoWaterPurifierCatalog(
  fetchImpl: FetchLike = fetch,
): Promise<MisoWaterPurifierCatalog> {
  const goodsList = await fetchMisoDirectoryGoods(fetchImpl);
  return mapMisoGoodsToCatalog(goodsList);
}

async function main(): Promise<void> {
  const catalog = await crawlMisoWaterPurifierCatalog();
  console.log(JSON.stringify(catalog, null, 2));
}

if (require.main === module) {
  void main();
}
