import type {
  ChannelQualityMetrics,
  ChannelSlug,
  CurrentCrawledOfferRow,
  DriftDetectionResult,
  DriftStatus,
} from './batch.types';

const WARNING_DROP_THRESHOLD = 0.25;
const CRITICAL_DROP_THRESHOLD = 0.5;
const NULL_RATE_WARNING_DELTA = 0.2;

function safeNullRate(nullCount: number, totalCount: number): number {
  if (totalCount === 0) {
    return 0;
  }

  return Number((nullCount / totalCount).toFixed(4));
}

function pushWarning(
  warnings: string[],
  status: DriftStatus,
  candidate: DriftStatus,
  warning: string,
): DriftStatus {
  warnings.push(warning);
  if (status === 'critical' || status === candidate) {
    return status;
  }

  if (candidate === 'critical') {
    return 'critical';
  }

  if (status === 'warning' && candidate === 'informational') {
    return status;
  }

  if (status === 'informational' && candidate === 'warning') {
    return candidate;
  }

  if (status === 'ok') {
    return candidate;
  }

  return status;
}

export function buildChannelQualityMetrics(
  rows: readonly CurrentCrawledOfferRow[],
): ChannelQualityMetrics {
  const affiliateCardRows = rows.filter((row) => row.hasAffiliateCard);

  return {
    offersCount: rows.length,
    contractTermNullRate: safeNullRate(
      rows.filter((row) => row.contractTermMonths === null).length,
      rows.length,
    ),
    managementTypeNullRate: safeNullRate(
      rows.filter((row) => row.managementType === null).length,
      rows.length,
    ),
    primaryCardCompanyNullRate: safeNullRate(
      rows.filter((row) => !row.primaryCardCompany).length,
      rows.length,
    ),
    affiliateCardOfferCount: affiliateCardRows.length,
    affiliateCardCompanyFilledCount: affiliateCardRows.filter((row) => Boolean(row.primaryCardCompany)).length,
    affiliateCardNameFilledCount: affiliateCardRows.filter((row) => Boolean(row.primaryCardName)).length,
  };
}

export function detectChannelDrift(
  channel: ChannelSlug,
  input: {
    previous: ChannelQualityMetrics | null;
    current: ChannelQualityMetrics;
  },
): DriftDetectionResult {
  const warnings: string[] = [];
  let status: DriftStatus = 'ok';

  if (input.current.offersCount === 0) {
    return {
      status: 'critical',
      warnings: ['offer_count_zero'],
    };
  }

  if (channel === 'miso' && input.current.affiliateCardOfferCount > 0) {
    const companyCoverage = input.current.affiliateCardCompanyFilledCount / input.current.affiliateCardOfferCount;

    if (companyCoverage === 0) {
      status = pushWarning(warnings, status, 'informational', 'miso_card_company_not_public');
    }
  }

  if (!input.previous || input.previous.offersCount === 0) {
    return {
      status,
      warnings,
    };
  }

  const offerDropRate =
    (input.previous.offersCount - input.current.offersCount) / input.previous.offersCount;

  if (offerDropRate >= CRITICAL_DROP_THRESHOLD) {
    status = pushWarning(warnings, status, 'critical', `offer_count_drop:${offerDropRate.toFixed(2)}`);
  } else if (offerDropRate >= WARNING_DROP_THRESHOLD) {
    status = pushWarning(warnings, status, 'warning', `offer_count_drop:${offerDropRate.toFixed(2)}`);
  }

  const nullRateChecks: Array<{
    label: string;
    previous: number;
    current: number;
  }> = [
    {
      label: 'contract_term_null_rate_increase',
      previous: input.previous.contractTermNullRate,
      current: input.current.contractTermNullRate,
    },
    {
      label: 'management_type_null_rate_increase',
      previous: input.previous.managementTypeNullRate,
      current: input.current.managementTypeNullRate,
    },
    {
      label: 'primary_card_company_null_rate_increase',
      previous: input.previous.primaryCardCompanyNullRate,
      current: input.current.primaryCardCompanyNullRate,
    },
  ];

  nullRateChecks.forEach((check) => {
    if (check.current - check.previous >= NULL_RATE_WARNING_DELTA) {
      status = pushWarning(
        warnings,
        status,
        'warning',
        `${check.label}:${check.previous.toFixed(2)}->${check.current.toFixed(2)}`,
      );
    }
  });

  if (
    channel !== 'miso' &&
    input.current.affiliateCardOfferCount > 0 &&
    input.current.affiliateCardCompanyFilledCount < input.current.affiliateCardOfferCount
  ) {
    status = pushWarning(
      warnings,
      status,
      'warning',
      `card_company_coverage_gap:${input.current.affiliateCardCompanyFilledCount}/${input.current.affiliateCardOfferCount}`,
    );
  }

  return {
    status,
    warnings,
  };
}

export type { ChannelQualityMetrics, CurrentCrawledOfferRow };
