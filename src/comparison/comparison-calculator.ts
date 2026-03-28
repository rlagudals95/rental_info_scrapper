import {
  ChannelOfferRecord,
  OfferCostSummary,
  SupportPricingModel,
} from './comparison.types';

function sanitizeRangeValue(value: number | null): number {
  return value ?? 0;
}

export function resolveMonthlyBurden12m(
  offer: Pick<ChannelOfferRecord, 'nonCardMonthlyFee' | 'publicMonthlyFee'>,
): number {
  const monthly = offer.nonCardMonthlyFee ?? offer.publicMonthlyFee ?? 0;
  return monthly * 12;
}

export function calculateOfferEffectiveCost12m(
  offer: Pick<
    ChannelOfferRecord,
    | 'nonCardMonthlyFee'
    | 'publicMonthlyFee'
    | 'supportPricingModel'
    | 'supportAmount'
    | 'supportAmountMin'
    | 'supportAmountMax'
  >,
): OfferCostSummary {
  const monthlyBurden12m = resolveMonthlyBurden12m(offer);

  switch (offer.supportPricingModel) {
    case 'fixed_public': {
      const supportAmount = offer.supportAmount ?? 0;
      return {
        monthlyBurden12m,
        effectiveCost12mMin: monthlyBurden12m - supportAmount,
        effectiveCost12mMax: monthlyBurden12m - supportAmount,
      };
    }
    case 'range_public': {
      const min = sanitizeRangeValue(offer.supportAmountMin);
      const max = sanitizeRangeValue(offer.supportAmountMax);
      return {
        monthlyBurden12m,
        effectiveCost12mMin: monthlyBurden12m - max,
        effectiveCost12mMax: monthlyBurden12m - min,
      };
    }
    case 'quote_required':
    case 'hidden':
    default:
      return {
        monthlyBurden12m,
        effectiveCost12mMin: monthlyBurden12m,
        effectiveCost12mMax: monthlyBurden12m,
      };
  }
}

export function compareOffersBySort(
  left: Pick<
    ChannelOfferRecord,
    | 'id'
    | 'nonCardMonthlyFee'
    | 'publicMonthlyFee'
    | 'supportPricingModel'
    | 'supportAmount'
    | 'supportAmountMin'
    | 'supportAmountMax'
  >,
  right: Pick<
    ChannelOfferRecord,
    | 'id'
    | 'nonCardMonthlyFee'
    | 'publicMonthlyFee'
    | 'supportPricingModel'
    | 'supportAmount'
    | 'supportAmountMin'
    | 'supportAmountMax'
  >,
  sort: 'lowestNonCardMonthlyFee' | 'effectiveCost12mMax',
): number {
  const leftCost = calculateOfferEffectiveCost12m(left);
  const rightCost = calculateOfferEffectiveCost12m(right);

  if (sort === 'effectiveCost12mMax') {
    if (leftCost.effectiveCost12mMax !== rightCost.effectiveCost12mMax) {
      return leftCost.effectiveCost12mMax - rightCost.effectiveCost12mMax;
    }
  }

  const leftNonCard = left.nonCardMonthlyFee ?? left.publicMonthlyFee ?? Number.MAX_SAFE_INTEGER;
  const rightNonCard =
    right.nonCardMonthlyFee ?? right.publicMonthlyFee ?? Number.MAX_SAFE_INTEGER;

  if (leftNonCard !== rightNonCard) {
    return leftNonCard - rightNonCard;
  }

  if (leftCost.effectiveCost12mMax !== rightCost.effectiveCost12mMax) {
    return leftCost.effectiveCost12mMax - rightCost.effectiveCost12mMax;
  }

  return left.id.localeCompare(right.id);
}

export function isPublicSupportModel(
  model: SupportPricingModel,
): model is 'fixed_public' | 'range_public' {
  return model === 'fixed_public' || model === 'range_public';
}
