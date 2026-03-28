import vm from 'node:vm';

import { ManagementType } from '../comparison/comparison.types';

interface RentreDetailBenefitData {
  title?: string | null;
  content?: string | null;
}

interface RentreDetailBenefitDetail {
  benefitType?: string | null;
  benefitData?: RentreDetailBenefitData[] | null;
}

interface RentreDetailBenefitGroup {
  benefitDetail?: RentreDetailBenefitDetail[] | null;
}

interface RentreDetailCareService {
  tabName?: string | null;
}

interface RentreDetailManageTypeItem {
  manageType?: string | null;
  manageTypeKorean?: string | null;
  manageTypeDesc?: string | null;
}

export interface RentreDetailPageData {
  prodOptionUsid: number;
  prodTermUsid: number;
  halfPricePromotion: boolean;
  halfPricePromotionPeriod: number | null;
  manageTypeList: RentreDetailManageTypeItem[];
  prodBenefitResponse?: {
    benefitList?: RentreDetailBenefitGroup[] | null;
  } | null;
  prodCareServiceResponse?: RentreDetailCareService[] | null;
}

export interface RentreDetailFallback {
  prodOptionUsid: number;
  prodTermUsid: number;
  resolvedManagementType: ManagementType | null;
  managementTypeOptions: ManagementType[];
  benefitTitles: string[];
  benefitContents: string[];
  promoTermHintMonths: number[];
  halfPricePromotion: boolean;
  halfPricePromotionPeriod: number | null;
}

const FLIGHT_SCRIPT_PATTERN = /<script>(self\.__next_f\.push\([\s\S]*?\))<\/script>/g;
const DETAIL_QUERY_MARKER = '"state":{"queries":[{"state":{"data":';

function extractFlightChunkStrings(html: string): string[] {
  const flightScripts = Array.from(html.matchAll(FLIGHT_SCRIPT_PATTERN)).map((match) => match[1]);
  const captured: unknown[] = [];

  flightScripts.forEach((script) => {
    const sandbox = {
      self: {
        __next_f: {
          push(value: unknown): void {
            captured.push(value);
          },
        },
      },
    };

    try {
      vm.runInNewContext(script, sandbox);
    } catch {
      // Ignore unrelated chunks and continue scanning other streamed payloads.
    }
  });

  return captured
    .filter((chunk): chunk is [unknown, string] => Array.isArray(chunk) && typeof chunk[1] === 'string')
    .map((chunk) => chunk[1]);
}

function extractJsonObjectAfterMarker(payload: string, markerIndex: number): string | null {
  const start = markerIndex + DETAIL_QUERY_MARKER.length;
  let inString = false;
  let isEscaped = false;
  let depth = 0;

  for (let index = start; index < payload.length; index += 1) {
    const char = payload[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return payload.slice(start, index + 1);
      }
    }
  }

  return null;
}

function isRentreDetailPageData(value: unknown): value is RentreDetailPageData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.prodOptionUsid === 'number' &&
    typeof candidate.prodTermUsid === 'number' &&
    Array.isArray(candidate.manageTypeList)
  );
}

function normalizeManagementType(rawValue: string | null | undefined): ManagementType | null {
  if (!rawValue) {
    return null;
  }

  const upperValue = rawValue.toUpperCase();

  if (upperValue === 'VISIT' || rawValue.includes('방문')) {
    return 'visit';
  }

  if (
    upperValue === 'NONE' ||
    upperValue === 'SELF' ||
    upperValue.includes('SELF_CARE') ||
    rawValue.includes('셀프') ||
    rawValue.includes('자가') ||
    rawValue.includes('기본 A/S')
  ) {
    return 'self';
  }

  return null;
}

function extractBenefitTitles(detailData: RentreDetailPageData): string[] {
  return ((detailData.prodBenefitResponse?.benefitList ?? []) as RentreDetailBenefitGroup[])
    .flatMap((group) => group.benefitDetail ?? [])
    .flatMap((detail) => detail.benefitData ?? [])
    .map((benefitData) => benefitData.title?.trim() ?? '')
    .filter((title) => title.length > 0);
}

function extractBenefitContents(detailData: RentreDetailPageData): string[] {
  return ((detailData.prodBenefitResponse?.benefitList ?? []) as RentreDetailBenefitGroup[])
    .flatMap((group) => group.benefitDetail ?? [])
    .flatMap((detail) => detail.benefitData ?? [])
    .map((benefitData) => benefitData.content?.trim() ?? '')
    .filter((content) => content.length > 0);
}

function parseHintYears(text: string): number[] {
  const months: number[] = [];

  for (const match of text.matchAll(/약정기간\s*([0-9,\s]+)년(?!이상)/g)) {
    const values = match[1]
      .split(/[^\d]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    values.forEach((value) => months.push(value * 12));
  }

  return months;
}

function parseHintMonths(text: string): number[] {
  const months: number[] = [];

  for (const match of text.matchAll(/약정기간\s*([0-9,\s]+)개월(?!이상)/g)) {
    const values = match[1]
      .split(/[^\d]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    values.forEach((value) => months.push(value));
  }

  return months;
}

function extractPromoTermHintMonths(contents: readonly string[]): number[] {
  return Array.from(
    new Set(contents.flatMap((content) => [...parseHintYears(content), ...parseHintMonths(content)])),
  ).sort((left, right) => left - right);
}

function resolveManagementTypeOptions(detailData: RentreDetailPageData): ManagementType[] {
  const options = [
    ...detailData.manageTypeList.map((item) => normalizeManagementType(item.manageType)),
    ...(detailData.prodCareServiceResponse ?? []).map((service) =>
      normalizeManagementType(service.tabName),
    ),
  ].filter((managementType): managementType is ManagementType => managementType !== null);

  return Array.from(new Set(options));
}

export function parseRentreDetailPageData(html: string): RentreDetailPageData | null {
  const payload = extractFlightChunkStrings(html).join('');
  let searchFrom = 0;

  while (true) {
    const markerIndex = payload.indexOf(DETAIL_QUERY_MARKER, searchFrom);

    if (markerIndex < 0) {
      return null;
    }

    const candidateJson = extractJsonObjectAfterMarker(payload, markerIndex);

    if (!candidateJson) {
      return null;
    }

    const parsed = JSON.parse(candidateJson) as unknown;

    if (isRentreDetailPageData(parsed)) {
      return {
        prodOptionUsid: parsed.prodOptionUsid,
        prodTermUsid: parsed.prodTermUsid,
        halfPricePromotion: Boolean(parsed.halfPricePromotion),
        halfPricePromotionPeriod:
          typeof parsed.halfPricePromotionPeriod === 'number' &&
          Number.isFinite(parsed.halfPricePromotionPeriod)
            ? parsed.halfPricePromotionPeriod
            : null,
        manageTypeList: parsed.manageTypeList,
        prodBenefitResponse: parsed.prodBenefitResponse ?? null,
        prodCareServiceResponse: parsed.prodCareServiceResponse ?? null,
      };
    }

    searchFrom = markerIndex + DETAIL_QUERY_MARKER.length;
  }
}

export function buildRentreDetailFallback(
  detailData: RentreDetailPageData,
): RentreDetailFallback {
  const managementTypeOptions = resolveManagementTypeOptions(detailData);
  const benefitTitles = extractBenefitTitles(detailData);
  const benefitContents = extractBenefitContents(detailData);

  return {
    prodOptionUsid: detailData.prodOptionUsid,
    prodTermUsid: detailData.prodTermUsid,
    resolvedManagementType:
      managementTypeOptions.length === 1 ? managementTypeOptions[0] : null,
    managementTypeOptions,
    benefitTitles,
    benefitContents,
    promoTermHintMonths: extractPromoTermHintMonths(benefitContents),
    halfPricePromotion: detailData.halfPricePromotion,
    halfPricePromotionPeriod: detailData.halfPricePromotionPeriod,
  };
}
