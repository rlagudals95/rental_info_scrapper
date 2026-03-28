import { parseSupportPricingText } from './support-pricing.util';

describe('parseSupportPricingText', () => {
  it('parses fixed support pricing', () => {
    expect(parseSupportPricingText('현금 12만원 지급')).toEqual({
      supportPricingModel: 'fixed_public',
      supportAmount: 120000,
      supportAmountMin: null,
      supportAmountMax: null,
    });
  });

  it('parses range support pricing', () => {
    expect(parseSupportPricingText('지원금 10만원~15만원')).toEqual({
      supportPricingModel: 'range_public',
      supportAmount: null,
      supportAmountMin: 100000,
      supportAmountMax: 150000,
    });
  });

  it('treats maximum-only copy as range support with zero minimum', () => {
    expect(parseSupportPricingText('최대 15만원 혜택')).toEqual({
      supportPricingModel: 'range_public',
      supportAmount: null,
      supportAmountMin: 0,
      supportAmountMax: 150000,
    });
  });

  it('parses quote-required copy', () => {
    expect(parseSupportPricingText('해피콜 시 확인')).toEqual({
      supportPricingModel: 'quote_required',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
    });
  });

  it('parses hidden support copy', () => {
    expect(parseSupportPricingText('숨어있는 지원금 혜택')).toEqual({
      supportPricingModel: 'hidden',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
    });
  });
});
