import {
  buildRentreProposalTermDetails,
  mapRentreListingsToCatalog,
  parseRentreProposalBadges,
  RentreProductListItemResponse,
  RentreProposalRequestResponseItem,
} from './rentre-water-purifier.crawler';
import { RentreDetailFallback } from './rentre-detail-page.parser';

function createBaseRentreItem(
  overrides: Partial<RentreProductListItemResponse> = {},
): RentreProductListItemResponse {
  return {
    prodUsid: 16003805,
    prodOptionUsid: 1600006842,
    prodTermUsid: 160000075168,
    eos: false,
    brand: 'COWAY',
    brandKorean: '코웨이',
    brandIconImgUrl: 'https://cdn.rentre.kr/brand-icon/v2/COWAY.png',
    prodOptionThumImgUrl: 'https://cdn.rentre.kr/product-thumbnail/coway.png',
    prodName: '아이콘3 냉온정 정수기',
    repProdName: '아이콘3 냉온정 정수기',
    originProdName: '아이콘3 냉온정 정수기',
    prodOptionModelCode: 'CHP-7220N',
    prodCatg: 'WATER_PURIFIER',
    prodCatgKorean: '정수기',
    rentalCompany: '코웨이',
    hasTvOption: false,
    hasTelOption: false,
    minNowProjSubsPrice: 14450,
    originMinNowProjSubsPrice: 28900,
    minNowProjSubsPriceIsHalfPricePromotion: true,
    minNowProjSubsPriceHalfPricePromotionPeriod: 12,
    hasAfltnCard: true,
    afltnCardDisc: 15000,
    fastDeliveryYn: false,
    halfPricePromotion: true,
    contractCount: 1000,
    expectDiscountRate: 56,
    prodBadgeResponse: {
      top: [
        {
          prodBadgeUsid: 1,
          title: '26년 2월 첫 공개!',
          badgeType: 'CUSTOM',
          badgeOrder: 0,
        },
      ],
      bottom: [
        {
          prodBadgeUsid: 2,
          title: '스마트 무빙 파우셋',
          badgeType: 'SERVICE',
          badgeOrder: 1,
        },
      ],
      img: [
        {
          prodBadgeUsid: 3,
          title: 'NEW',
          badgeType: 'NEW',
          badgeOrder: 2,
        },
      ],
    },
    prodReviewScoreCountResponse: {
      prodUsid: 16003805,
      totalCount: 112,
      totalAvgScore: '4.9',
    },
    prodPaybackResponse: {
      prodUsid: 16003805,
      noData: false,
      minPayback: 120000,
      maxPayback: 370000,
      minPaybackForDisplay: 12,
      maxPaybackForDisplay: 37,
      sameMinMax: false,
    },
    ...overrides,
  };
}

describe('parseRentreProposalBadges', () => {
  it('parses obligation, transfer, management, and cycle badges', () => {
    expect(
      parseRentreProposalBadges([
        '36개월 의무사용',
        '60개월 소유권이전',
        '셀프관리 (소모품 배송)',
        '6개월 주기',
      ]),
    ).toEqual({
      contractTermMonths: 60,
      obligationTermMonths: 36,
      ownershipTransferMonths: 60,
      managementType: 'self',
      maintenanceCycleMonths: 6,
    });
  });
});

describe('mapRentreListingsToCatalog', () => {
  it('expands term-specific public offers from detail proposal terms and merges sections', () => {
    const mainListItems: RentreProductListItemResponse[] = [createBaseRentreItem()];
    const newArrivalItems: RentreProductListItemResponse[] = [
      createBaseRentreItem({
        prodBadgeResponse: {
          top: [
            {
              prodBadgeUsid: 4,
              title: '새로 등록된 제품',
              badgeType: 'CUSTOM',
              badgeOrder: 0,
            },
          ],
          bottom: [],
          img: [],
        },
      }),
    ];
    const proposalTerms = buildRentreProposalTermDetails([
      {
        name: '신**님',
        address: '인천시 남동구',
        prodUsid: 16003805,
        prodOptionUsid: 1600006842,
        prodTermUsid: 160000075168,
        prodName: '아이콘3 냉온정 정수기',
        repProdName: '아이콘3 냉온정 정수기',
        prodOptionThumImgUrl: 'https://cdn.rentre.kr/product-thumbnail/coway.png',
        prodOptionModelCode: 'CHP-7220N',
        brandKorean: '코웨이',
        badgeList: [
          '84개월 의무사용',
          '84개월 소유권이전',
          '셀프관리 (소모품 배송)',
          '6개월 주기',
        ],
        isTps: false,
        propSummaryList: [],
      },
      {
        name: '성**님',
        address: '전라남도 광양시',
        prodUsid: 16003805,
        prodOptionUsid: 1600006842,
        prodTermUsid: 160000075170,
        prodName: '아이콘3 냉온정 정수기',
        repProdName: '아이콘3 냉온정 정수기',
        prodOptionThumImgUrl: 'https://cdn.rentre.kr/product-thumbnail/coway.png',
        prodOptionModelCode: 'CHP-7220N',
        brandKorean: '코웨이',
        badgeList: ['72개월 의무사용', '72개월 소유권이전', '방문관리', '4개월 주기'],
        isTps: false,
        propSummaryList: [],
      },
    ] satisfies RentreProposalRequestResponseItem[]);

    const catalog = mapRentreListingsToCatalog(
      mainListItems,
      newArrivalItems,
      227,
      '2026-03-27T00:00:00.000Z',
      {
        proposalTermsByProdOptionUsid: new Map([[1600006842, proposalTerms]]),
        termListingsByProdTermUsid: new Map([
          [
            160000075168,
            createBaseRentreItem({
              prodTermUsid: 160000075168,
              minNowProjSubsPrice: 14450,
              originMinNowProjSubsPrice: 28900,
              minNowProjSubsPriceHalfPricePromotionPeriod: 12,
            }),
          ],
          [
            160000075170,
            createBaseRentreItem({
              prodTermUsid: 160000075170,
              minNowProjSubsPrice: 15255,
              originMinNowProjSubsPrice: 30510,
              minNowProjSubsPriceHalfPricePromotionPeriod: 12,
            }),
          ],
        ]),
        featuredAffiliateCardByProdTermUsid: new Map([
          [
            160000075168,
            {
              afltnCardUsid: 1,
              afltnCardName: 'KB국민 코웨이 II 카드',
              afltnCardCompany: 'KB카드',
              afltnCardImg: 'https://cdn.rentre.kr/afltn-card/KB_CO.png',
              mandatoryCnt: 84,
              subsPrice: 28900,
            },
          ],
          [
            160000075170,
            {
              afltnCardUsid: 2,
              afltnCardName: '롯데 코웨이카드',
              afltnCardCompany: '롯데카드',
              afltnCardImg: 'https://cdn.rentre.kr/afltn-card/LOTTE_CO.png',
              mandatoryCnt: 72,
              subsPrice: 30510,
            },
          ],
        ]),
      },
    );

    expect(catalog.pageTotalCount).toBe(227);
    expect(catalog.productsCount).toBe(1);
    expect(catalog.offersCount).toBe(2);
    expect(catalog.products[0]).toMatchObject({
      brandName: '코웨이',
      productName: '아이콘3 냉온정 정수기',
      modelCode: 'CHP-7220N',
      featureTags: ['냉수', '온수', '정수'],
      metadata: {
        sections: ['main_list', 'new_arrivals'],
        rating: 4.9,
        reviewCount: 112,
        orderCount: 1000,
        promoDurationMonths: 12,
        postPromoMonthlyFee: 28900,
      },
    });

    expect(catalog.products[0].offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prodTermUsid: 160000075170,
          contractTermMonths: 72,
          managementType: 'visit',
          publicMonthlyFee: 15255,
          cardAppliedMonthlyFee: 255,
          metadata: expect.objectContaining({
            sections: ['main_list', 'new_arrivals'],
            maintenanceCycleMonths: 4,
            termDiscoverySource: 'proposal_badges',
            priceSource: 'list_api_by_term',
            benefitEvidence: 'api_payback_range',
            cardNames: ['롯데 코웨이카드'],
            cardCompanies: ['롯데카드'],
          }),
        }),
        expect.objectContaining({
          prodTermUsid: 160000075168,
          contractTermMonths: 84,
          managementType: 'self',
          publicMonthlyFee: 14450,
          cardAppliedMonthlyFee: 0,
          metadata: expect.objectContaining({
            sections: ['main_list', 'new_arrivals'],
            maintenanceCycleMonths: 6,
            termDiscoverySource: 'proposal_badges',
            priceSource: 'list_api_by_term',
            benefitEvidence: 'api_payback_range',
            cardNames: ['KB국민 코웨이 II 카드'],
            cardCompanies: ['KB카드'],
          }),
        }),
      ]),
    );
  });

  it('falls back to current list offer when detail terms are unavailable', () => {
    const detailFallback: RentreDetailFallback = {
      prodOptionUsid: 1522013399,
      prodTermUsid: 160000055569,
      resolvedManagementType: 'self',
      managementTypeOptions: ['self'],
      benefitTitles: ['반값할인 프로모션'],
      benefitContents: ['약정기간 5년 : 6개월 반값할인'],
      promoTermHintMonths: [60],
      halfPricePromotion: true,
      halfPricePromotionPeriod: 6,
    };

    const catalog = mapRentreListingsToCatalog(
      [
        createBaseRentreItem({
          prodUsid: 15222254,
          prodOptionUsid: 1522013399,
          prodTermUsid: 160000055569,
          brand: 'CUCKOO',
          brandKorean: '쿠쿠',
          brandIconImgUrl: 'https://cdn.rentre.kr/brand-icon/v2/CUCKOO.png',
          prodOptionThumImgUrl: 'https://cdn.rentre.kr/product-thumbnail/cuckoo.png',
          prodName: '제로 100 슬림 냉온정 얼음정수기',
          repProdName: '제로 100 슬림 냉온정 얼음정수기',
          originProdName: '제로 100 슬림 냉온정 얼음정수기',
          prodOptionModelCode: 'CP-AHS100HEW(S)',
          rentalCompany: '쿠쿠',
          minNowProjSubsPrice: 20950,
          originMinNowProjSubsPrice: 41900,
          afltnCardDisc: 10000,
          contractCount: 4000,
          expectDiscountRate: 63,
          prodBadgeResponse: null,
          prodReviewScoreCountResponse: null,
          prodPaybackResponse: {
            prodUsid: 15222254,
            noData: true,
            minPayback: null,
            maxPayback: null,
            minPaybackForDisplay: null,
            maxPaybackForDisplay: null,
            sameMinMax: false,
          },
        }),
      ],
      [],
      227,
      '2026-03-27T00:00:00.000Z',
      {
        detailFallbackByProdOptionUsid: new Map([[1522013399, detailFallback]]),
      },
    );

    expect(catalog.products[0].offers[0]).toMatchObject({
      contractTermMonths: null,
      managementType: 'self',
      cardAppliedMonthlyFee: 10950,
      supportPricingModel: 'hidden',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
      metadata: {
        benefitEvidence: 'api_payback_hidden',
        termDiscoverySource: 'list_only',
        managementDiscoverySource: 'detail_payload',
        managementTypeOptions: ['self'],
        promoTermHintMonths: [60],
        benefitHighlights: ['반값할인 프로모션'],
        cardNames: [],
        cardCompanies: [],
      },
    });
  });
});
