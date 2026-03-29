import {
  buildChannelQualityMetrics,
  detectChannelDrift,
  type CurrentCrawledOfferRow,
} from './drift-detector';

describe('buildChannelQualityMetrics', () => {
  it('calculates null rates and card coverage from current offer rows', () => {
    const rows: CurrentCrawledOfferRow[] = [
      {
        channel: 'rentre',
        externalOfferId: 'offer-1',
        externalProductId: 'product-1',
        productDetailUrl: 'https://rentre.kr/product/1',
        offerUrl: 'https://rentre.kr/product/1',
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl: 'https://rentre.kr/water-purifier',
        brandName: 'LG',
        productName: '퓨리케어',
        modelCode: 'WD523A',
        publicMonthlyFee: 30900,
        cardAppliedMonthlyFee: 15900,
        cardDiscountAmount: 15000,
        hasAffiliateCard: true,
        primaryCardCompany: 'KB카드',
        primaryCardName: 'KB 렌탈카드',
        cardCompanies: ['KB카드'],
        cardNames: ['KB 렌탈카드'],
        contractTermMonths: 72,
        obligationTermMonths: 72,
        ownershipTransferMonths: 72,
        managementType: 'visit',
        maintenanceCycleMonths: 6,
        maintenancePeriodMonths: null,
        commitmentPeriodMonths: 72,
        promoDurationMonths: 6,
        postPromoMonthlyFee: 45900,
        supportPricingModel: 'range_public',
        supportAmount: null,
        supportAmountMin: 100000,
        supportAmountMax: 200000,
        rating: 4.9,
        reviewCount: 100,
        orderCount: 12,
        rankingRank: null,
        featureTags: ['냉수'],
        metadata: {},
      },
      {
        channel: 'rentre',
        externalOfferId: 'offer-2',
        externalProductId: 'product-1',
        productDetailUrl: 'https://rentre.kr/product/1',
        offerUrl: 'https://rentre.kr/product/1',
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl: 'https://rentre.kr/water-purifier',
        brandName: 'LG',
        productName: '퓨리케어',
        modelCode: 'WD523A',
        publicMonthlyFee: 32900,
        cardAppliedMonthlyFee: null,
        cardDiscountAmount: null,
        hasAffiliateCard: false,
        primaryCardCompany: null,
        primaryCardName: null,
        cardCompanies: [],
        cardNames: [],
        contractTermMonths: null,
        obligationTermMonths: null,
        ownershipTransferMonths: null,
        managementType: null,
        maintenanceCycleMonths: null,
        maintenancePeriodMonths: null,
        commitmentPeriodMonths: null,
        promoDurationMonths: null,
        postPromoMonthlyFee: null,
        supportPricingModel: 'hidden',
        supportAmount: null,
        supportAmountMin: null,
        supportAmountMax: null,
        rating: 4.9,
        reviewCount: 100,
        orderCount: 12,
        rankingRank: null,
        featureTags: ['냉수'],
        metadata: {},
      },
    ];

    expect(buildChannelQualityMetrics(rows)).toEqual({
      offersCount: 2,
      contractTermNullRate: 0.5,
      managementTypeNullRate: 0.5,
      primaryCardCompanyNullRate: 0.5,
      affiliateCardOfferCount: 1,
      affiliateCardCompanyFilledCount: 1,
      affiliateCardNameFilledCount: 1,
    });
  });
});

describe('detectChannelDrift', () => {
  it('returns warning when offer count drops by 25 percent or more', () => {
    const result = detectChannelDrift('ajd', {
      previous: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 50,
        affiliateCardCompanyFilledCount: 50,
        affiliateCardNameFilledCount: 50,
      },
      current: {
        offersCount: 74,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 40,
        affiliateCardCompanyFilledCount: 40,
        affiliateCardNameFilledCount: 40,
      },
    });

    expect(result.status).toBe('warning');
    expect(result.warnings[0]).toContain('offer_count_drop');
  });

  it('returns critical when offer count drops by 50 percent or more', () => {
    const result = detectChannelDrift('ajd', {
      previous: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 50,
        affiliateCardCompanyFilledCount: 50,
        affiliateCardNameFilledCount: 50,
      },
      current: {
        offersCount: 49,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 40,
        affiliateCardCompanyFilledCount: 40,
        affiliateCardNameFilledCount: 40,
      },
    });

    expect(result.status).toBe('critical');
  });

  it('treats missing miso card company data as informational instead of warning', () => {
    const result = detectChannelDrift('miso', {
      previous: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 1,
        affiliateCardOfferCount: 100,
        affiliateCardCompanyFilledCount: 0,
        affiliateCardNameFilledCount: 0,
      },
      current: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 1,
        affiliateCardOfferCount: 100,
        affiliateCardCompanyFilledCount: 0,
        affiliateCardNameFilledCount: 0,
      },
    });

    expect(result.status).toBe('informational');
    expect(result.warnings).toContain('miso_card_company_not_public');
  });
});
