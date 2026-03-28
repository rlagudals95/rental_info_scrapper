import { SupportPricingModel } from '../comparison/comparison.types';

export interface ParsedSupportPricing {
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
}

const QUOTE_REQUIRED_PATTERNS = ['상담 시', '상담후', '상담 후', '해피콜', '문의 시', '별도 안내'];
const HIDDEN_PATTERNS = ['지원금', '혜택', '사은품'];

function toWon(rawValue: string): number {
  const normalized = rawValue.replace(/,/g, '').trim();

  const manwonMatch = normalized.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manwonMatch) {
    return Math.round(Number(manwonMatch[1]) * 10000);
  }

  const wonMatch = normalized.match(/(\d+(?:\.\d+)?)\s*원/);
  if (wonMatch) {
    return Math.round(Number(wonMatch[1]));
  }

  return Math.round(Number(normalized));
}

function extractCurrencyTokens(text: string): string[] {
  return text.match(/\d+(?:,\d{3})*(?:\.\d+)?\s*만\s*원?|\d+(?:,\d{3})*(?:\.\d+)?\s*원/g) ?? [];
}

export function parseSupportPricingText(text: string): ParsedSupportPricing {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (QUOTE_REQUIRED_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      supportPricingModel: 'quote_required',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
    };
  }

  const currencyTokens = extractCurrencyTokens(normalized);

  if (
    currencyTokens.length >= 2 &&
    (normalized.includes('~') || normalized.includes('-') || normalized.includes('부터'))
  ) {
    const [minToken, maxToken] = currencyTokens;

    return {
      supportPricingModel: 'range_public',
      supportAmount: null,
      supportAmountMin: toWon(minToken),
      supportAmountMax: toWon(maxToken),
    };
  }

  if (currencyTokens.length >= 1 && normalized.includes('최대')) {
    const maxToken = currencyTokens[0];

    return {
      supportPricingModel: 'range_public',
      supportAmount: null,
      supportAmountMin: 0,
      supportAmountMax: toWon(maxToken),
    };
  }

  if (currencyTokens.length >= 1) {
    const token = currencyTokens[0];

    return {
      supportPricingModel: 'fixed_public',
      supportAmount: toWon(token),
      supportAmountMin: null,
      supportAmountMax: null,
    };
  }

  if (HIDDEN_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      supportPricingModel: 'hidden',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
    };
  }

  return {
    supportPricingModel: 'hidden',
    supportAmount: null,
    supportAmountMin: null,
    supportAmountMax: null,
  };
}
