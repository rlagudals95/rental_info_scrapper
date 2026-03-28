import {
  buildWaterPurifierOfferCsvRows,
  buildWaterPurifierProductCsvRows,
  renderCsv,
} from './export-water-purifier-csv';
import type { AllWaterPurifierCrawlResult } from './all-water-purifier.crawler';

describe('renderCsv', () => {
  it('escapes commas, quotes, and newlines', () => {
    const csv = renderCsv(
      [
        {
          alpha: 'hello,world',
          beta: 'say "hi"',
          gamma: 'line1\nline2',
        },
      ],
      ['alpha', 'beta', 'gamma'],
    );

    expect(csv).toBe('alpha,beta,gamma\n"hello,world","say ""hi""","line1\nline2"');
  });
});

describe('buildWaterPurifierCsvRows', () => {
  it('builds product and offer rows from channel crawl results', () => {
    const result: AllWaterPurifierCrawlResult = {
      fetchedAt: '2026-03-27T00:00:00.000Z',
      channels: {
        ajd: {
          fetchedAt: '2026-03-27T00:00:00.000Z',
          sourceUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
          pageTitle: 'ajd',
          rankingLabel: '종합점수',
          pageTotalCount: 175,
          productsCount: 1,
          offersCount: 1,
          products: [
            {
              externalProductId: 'ajd:RWP70F15AN',
              rankingRank: 1,
              brandName: '삼성',
              productName: '비스포크',
              modelCode: 'RWP70F15AN',
              detailUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
              thumbnailUrl: 'https://image.ajd.kr/1',
              featureTags: ['냉수', '정수'],
              metadata: {
                totalScore: 95.3,
                reviewCount: 12,
                textBadges: ['위생기능 1위'],
                specifications: { 제품유형: '데스크형' },
                scoreBreakdown: { 정수성능: 96 },
              },
              offers: [
                {
                  externalOfferId: 'ajd:offer:1',
                  offerName: '삼성 비스포크',
                  publicOfferUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
                  managementType: 'self',
                  contractTermMonths: 60,
                  publicMonthlyFee: 34900,
                  cardAppliedMonthlyFee: 21900,
                  supportPricingModel: 'hidden',
                  supportAmount: null,
                  supportAmountMin: null,
                  supportAmountMax: null,
                  metadata: {
                    rankingRank: 1,
                    benefitEvidence: 'not_exposed_in_ranking',
                    cardNames: ['뉴렌탈플러스 하나카드'],
                    cardCompanies: ['하나카드'],
                  },
                },
              ],
            },
          ],
        },
        miso: {
          fetchedAt: '2026-03-27T00:00:00.000Z',
          sourceUrl: 'https://miso.kr/booking/rental/water_purifier',
          sourceApiUrl: 'https://www.getmiso.com//lambdaro/public/directory-v1-get-goods',
          productsCount: 1,
          offersCount: 1,
          products: [
            {
              externalProductId: 'miso:2937',
              goodsId: 2937,
              goodsCode: 'WPUJAC104S',
              brandName: 'SK매직',
              productName: '초소형 직수',
              modelCode: 'WPUJAC104S',
              detailUrl: 'https://miso.kr/booking/rental/water_purifier/WPUJAC104S',
              thumbnailUrl: 'https://miso.kr/thumb.png',
              detailImageUrl: null,
              featureTags: ['냉수', '온수', '정수'],
              metadata: {
                popularity: 1,
                listingRank: 2,
                listingTag: 'NEW',
                listingDescription: 'desc',
                formFactor: '데스크형',
                purificationType: '직수형',
                purifierFunctionsRaw: '냉온정',
                filterMethod: null,
                colorNames: ['화이트'],
              },
              offers: [
                {
                  externalOfferId: 'miso:2937:2938',
                  stockId: 2938,
                  serial: 'WPUJAC104SWH',
                  offerName: 'SK매직 초소형 직수',
                  publicOfferUrl: 'https://miso.kr/booking/rental/water_purifier/WPUJAC104S',
                  managementType: 'visit',
                  contractTermMonths: 84,
                  publicMonthlyFee: 31400,
                  cardAppliedMonthlyFee: 14400,
                  cardDiscountAmount: 17000,
                  supportPricingModel: 'fixed_public',
                  supportAmount: 200000,
                  supportAmountMin: null,
                  supportAmountMax: null,
                  metadata: {
                    maintenancePeriodMonths: 4,
                    commitmentPeriodMonths: 84,
                    isRecommended: false,
                    colorCode: '#F4F1F0',
                    benefitEvidence: 'api_payback',
                  },
                },
              ],
            },
          ],
        },
        rentre: {
          fetchedAt: '2026-03-27T00:00:00.000Z',
          sourceUrl: 'https://rentre.kr/water-purifier',
          sourceApiUrl: 'https://api.doublecheck.kr/api/v3/product/listBySearch',
          newArrivalApiUrl: 'https://api.doublecheck.kr/api/v2/product/new/list',
          pageTotalCount: 227,
          mainListCount: 227,
          newArrivalCount: 5,
          productsCount: 1,
          offersCount: 1,
          products: [
            {
              externalProductId: 'rentre:1600004391',
              prodOptionUsid: 1600004391,
              prodUsid: 1600004391,
              brandName: 'LG',
              productName: '퓨리케어 오브제컬렉션 냉온정 정수기',
              modelCode: 'WD523A',
              detailUrl: 'https://rentre.kr/product/1600004391',
              thumbnailUrl: 'https://cdn.rentre.kr/1.png',
              featureTags: ['냉수', '온수', '정수'],
              metadata: {
                sections: ['main_list'],
                badges: ['BEST'],
                rating: 4.9,
                reviewCount: 268,
                orderCount: 1000,
                expectDiscountRate: 50,
                hasAffiliateCard: true,
                affiliateCardDiscountAmount: 15000,
                isHalfPricePromotion: true,
                promoDurationMonths: 6,
                postPromoMonthlyFee: 32900,
                brandCode: 'LG',
                rentalCompany: 'LG',
              },
              offers: [
                {
                  externalOfferId: 'rentre:1600004391:1600001',
                  prodTermUsid: 1600001,
                  offerName: 'LG 퓨리케어',
                  publicOfferUrl: 'https://rentre.kr/product/1600004391',
                  contractTermMonths: 72,
                  managementType: 'visit',
                  publicMonthlyFee: 16450,
                  cardAppliedMonthlyFee: 1450,
                  supportPricingModel: 'range_public',
                  supportAmount: null,
                  supportAmountMin: 120000,
                  supportAmountMax: 370000,
                  metadata: {
                    postPromoMonthlyFee: 32900,
                    promoDurationMonths: 6,
                    expectDiscountRate: 50,
                    affiliateCardDiscountAmount: 15000,
                    hasAffiliateCard: true,
                    sections: ['main_list'],
                    benefitEvidence: 'api_payback_range',
                    obligationTermMonths: 72,
                    ownershipTransferMonths: 72,
                    maintenanceCycleMonths: 6,
                    termDiscoverySource: 'proposal_badges',
                    managementDiscoverySource: 'proposal_badges',
                    priceSource: 'list_api_by_term',
                    managementTypeOptions: ['visit'],
                    promoTermHintMonths: [72],
                    benefitHighlights: ['반값할인 프로모션'],
                    cardNames: ['KB국민 코웨이 II 카드'],
                    cardCompanies: ['KB카드'],
                    cardImageUrl: 'https://cdn.rentre.kr/afltn-card/KB_CO.png',
                  },
                },
              ],
            },
          ],
        },
      },
      summary: {
        totalProducts: 3,
        totalOffers: 3,
        channelProductCounts: {
          ajd: 1,
          miso: 1,
          rentre: 1,
        },
        channelOfferCounts: {
          ajd: 1,
          miso: 1,
          rentre: 1,
        },
      },
    };

    const productRows = buildWaterPurifierProductCsvRows(result);
    const offerRows = buildWaterPurifierOfferCsvRows(result);

    expect(productRows).toHaveLength(3);
    expect(offerRows).toHaveLength(3);
    expect(productRows[0]).toMatchObject({
      channel: 'ajd',
      model_code: 'RWP70F15AN',
      ranking_rank: 1,
    });
    expect(offerRows[0]).toMatchObject({
      channel: 'ajd',
      card_discount_amount: null,
      has_affiliate_card: false,
      primary_card_company: '하나카드',
      primary_card_name: '뉴렌탈플러스 하나카드',
      contract_term_months: 60,
      management_type: 'self',
      support_pricing_model: 'hidden',
    });
    expect(offerRows[1]).toMatchObject({
      channel: 'miso',
      card_discount_amount: 17000,
      has_affiliate_card: true,
      primary_card_company: null,
      primary_card_name: null,
      contract_term_months: 84,
      obligation_term_months: 84,
      management_type: 'visit',
      maintenance_cycle_months: 4,
      support_pricing_model: 'fixed_public',
    });
    expect(offerRows[2]).toMatchObject({
      channel: 'rentre',
      card_applied_monthly_fee: 1450,
      card_discount_amount: 15000,
      has_affiliate_card: true,
      primary_card_company: 'KB카드',
      primary_card_name: 'KB국민 코웨이 II 카드',
      contract_term_months: 72,
      obligation_term_months: 72,
      ownership_transfer_months: 72,
      management_type: 'visit',
      maintenance_cycle_months: 6,
      promo_duration_months: 6,
      post_promo_monthly_fee: 32900,
      support_pricing_model: 'range_public',
    });
  });
});
