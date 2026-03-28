import { BadRequestException } from '@nestjs/common';

import {
  ComparisonListQuery,
  ManagementType,
  SortKey,
  SupportPricingModel,
} from './comparison.types';

type RawQueryValue = string | string[] | undefined;
type RawQuery = Record<string, RawQueryValue>;

function takeFirst(value: RawQueryValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseBoolean(value: string | undefined, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (['true', '1', 'yes'].includes(value.toLowerCase())) {
    return true;
  }

  if (['false', '0', 'no'].includes(value.toLowerCase())) {
    return false;
  }

  throw new BadRequestException(`${fieldName} must be a boolean`);
}

function parseNumber(value: string | undefined, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException(`${fieldName} must be a number`);
  }

  return numericValue;
}

function parseManagementType(value: string | undefined): ManagementType | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'visit' || value === 'self') {
    return value;
  }

  throw new BadRequestException('managementType must be visit or self');
}

function parseSupportPricingModel(
  value: string | undefined,
): SupportPricingModel | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === 'fixed_public' ||
    value === 'range_public' ||
    value === 'quote_required' ||
    value === 'hidden'
  ) {
    return value;
  }

  throw new BadRequestException(
    'supportPricingModel must be fixed_public, range_public, quote_required, or hidden',
  );
}

function parseSort(value: string | undefined): SortKey {
  if (value === undefined) {
    return 'lowestNonCardMonthlyFee';
  }

  if (value === 'lowestNonCardMonthlyFee' || value === 'effectiveCost12mMax') {
    return value;
  }

  throw new BadRequestException(
    'sort must be lowestNonCardMonthlyFee or effectiveCost12mMax',
  );
}

export function parseComparisonListQuery(query: RawQuery): ComparisonListQuery {
  return {
    brand: takeFirst(query.brand),
    managementType: parseManagementType(takeFirst(query.managementType)),
    contractTermMonths: parseNumber(takeFirst(query.contractTermMonths), 'contractTermMonths'),
    hasIce: parseBoolean(takeFirst(query.hasIce), 'hasIce'),
    maxNonCardMonthlyFee: parseNumber(
      takeFirst(query.maxNonCardMonthlyFee),
      'maxNonCardMonthlyFee',
    ),
    supportPricingModel: parseSupportPricingModel(takeFirst(query.supportPricingModel)),
    sort: parseSort(takeFirst(query.sort)),
  };
}
