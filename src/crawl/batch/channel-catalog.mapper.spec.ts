import { mapChannelCatalogToCurrentRows } from './channel-catalog.mapper';

describe('mapChannelCatalogToCurrentRows', () => {
  it('maps ajd product and offer data into current row shapes', () => {
    const result = mapChannelCatalogToCurrentRows('ajd', {
      fetchedAt: '2026-03-28T00:00:00.000Z',
      sourceUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
      pageTitle: '정수기 랭킹',
      rankingLabel: '종합점수',
      pageTotalCount: 175,
      productsCount: 1,
      offersCount: 1,
      products: [
        {
          externalProductId: 'ajd:1',
          rankingRank: 1,
          brandName: '코웨이',
          productName: '아이콘',
          modelCode: 'CHPI-7400N',
          detailUrl: 'https://www.ajd.co.kr/electronics/overview/4020/detail/1',
          thumbnailUrl: null,
          featureTags: ['냉수', '정수'],
          metadata: {
            totalScore: 95.2,
            reviewCount: 10,
            textBadges: ['BEST'],
            specifications: { 정수방식: '직수형' },
            scoreBreakdown: { 위생: 95 },
          },
          offers: [
            {
              externalOfferId: 'ajd:1:offer:1',
              offerName: '코웨이 아이콘 60개월 방문',
              publicOfferUrl: 'https://www.ajd.co.kr/electronics/overview/4020/detail/1',
              managementType: 'visit',
              contractTermMonths: 60,
              publicMonthlyFee: 30900,
              cardAppliedMonthlyFee: 15900,
              supportPricingModel: 'hidden',
              supportAmount: null,
              supportAmountMin: null,
              supportAmountMax: null,
              metadata: {
                rankingRank: 1,
                benefitEvidence: 'not_exposed_in_detail',
                cardDiscountAmount: 15000,
                cardCompanies: ['롯데카드'],
                cardNames: ['렌탈 롯데카드'],
              },
            },
          ],
        },
      ],
    });

    expect(result.products).toHaveLength(1);
    expect(result.offers).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      channel: 'ajd',
      externalProductId: 'ajd:1',
      offerCount: 1,
    });
    expect(result.offers[0]).toMatchObject({
      channel: 'ajd',
      externalOfferId: 'ajd:1:offer:1',
      primaryCardCompany: '롯데카드',
      contractTermMonths: 60,
      managementType: 'visit',
    });
  });
});
