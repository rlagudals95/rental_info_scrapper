import {
  buildRentreDetailFallback,
  parseRentreDetailPageData,
} from './rentre-detail-page.parser';

function createDetailPageHtml(detailData: Record<string, unknown>): string {
  const chunk = `preface ${`"state":{"queries":[{"state":{"data":${JSON.stringify(detailData)}}}]}`}`;
  return `<html><body><script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script></body></html>`;
}

describe('parseRentreDetailPageData', () => {
  it('extracts product detail data from streamed next payload chunks', () => {
    const html = createDetailPageHtml({
      prodOptionUsid: 1600005617,
      prodTermUsid: 160000069934,
      halfPricePromotion: true,
      halfPricePromotionPeriod: 12,
      manageTypeList: [
        {
          manageType: 'SELF',
          manageTypeKorean: '셀프관리 (소모품 배송)',
          manageTypeDesc:
            '소모품을 #{maintenanceCyclePeriod}마다 배송받아 셀프로 교체, 관리하는 방식입니다.',
        },
      ],
      prodBenefitResponse: {
        benefitList: [
          {
            benefitDetail: [
              {
                benefitType: 'HALF_PRICE_PROMOTION',
                benefitData: [
                  {
                    title: '반값할인 프로모션',
                    content:
                      '약정기간 5년 : 10개월간 렌탈료 반값\n약정기간 6,7년 : 12개월간 렌탈료 반값',
                  },
                ],
              },
            ],
          },
        ],
      },
      prodCareServiceResponse: [{ tabName: '셀프관리' }],
    });

    expect(parseRentreDetailPageData(html)).toEqual({
      prodOptionUsid: 1600005617,
      prodTermUsid: 160000069934,
      halfPricePromotion: true,
      halfPricePromotionPeriod: 12,
      manageTypeList: [
        {
          manageType: 'SELF',
          manageTypeKorean: '셀프관리 (소모품 배송)',
          manageTypeDesc:
            '소모품을 #{maintenanceCyclePeriod}마다 배송받아 셀프로 교체, 관리하는 방식입니다.',
        },
      ],
      prodBenefitResponse: {
        benefitList: [
          {
            benefitDetail: [
              {
                benefitType: 'HALF_PRICE_PROMOTION',
                benefitData: [
                  {
                    title: '반값할인 프로모션',
                    content:
                      '약정기간 5년 : 10개월간 렌탈료 반값\n약정기간 6,7년 : 12개월간 렌탈료 반값',
                  },
                ],
              },
            ],
          },
        ],
      },
      prodCareServiceResponse: [{ tabName: '셀프관리' }],
    });
  });
});

describe('buildRentreDetailFallback', () => {
  it('normalizes management options and extracts promo term hints', () => {
    const fallback = buildRentreDetailFallback({
      prodOptionUsid: 1600005912,
      prodTermUsid: 160000080001,
      halfPricePromotion: true,
      halfPricePromotionPeriod: 12,
      manageTypeList: [
        {
          manageType: 'NONE',
          manageTypeKorean: '기본 A/S',
          manageTypeDesc: null,
        },
      ],
      prodBenefitResponse: {
        benefitList: [
          {
            benefitDetail: [
              {
                benefitType: 'HALF_PRICE_PROMOTION',
                benefitData: [
                  {
                    title: '반값할인 프로모션',
                    content:
                      '약정기간 5년 : 6개월 반값할인\n약정기간 6,7년 : 12개월 반값할인',
                  },
                ],
              },
            ],
          },
        ],
      },
      prodCareServiceResponse: [],
    });

    expect(fallback).toEqual({
      prodOptionUsid: 1600005912,
      prodTermUsid: 160000080001,
      resolvedManagementType: 'self',
      managementTypeOptions: ['self'],
      benefitTitles: ['반값할인 프로모션'],
      benefitContents: ['약정기간 5년 : 6개월 반값할인\n약정기간 6,7년 : 12개월 반값할인'],
      promoTermHintMonths: [60, 72, 84],
      halfPricePromotion: true,
      halfPricePromotionPeriod: 12,
    });
  });
});
