import {
  extractMisoNextPageProps,
  mapMisoGoodsToCatalog,
  MisoDirectoryGoodsResponse,
} from './miso-water-purifier.crawler';

describe('mapMisoGoodsToCatalog', () => {
  it('maps payback cash to a fixed public support offer', () => {
    const catalog = mapMisoGoodsToCatalog([
      {
        id: 3301,
        brand: '코웨이',
        goods_code: 'CHP-7220N',
        goods_type: 'water_purifier',
        name: '아이콘3',
        popularity: 1,
        rank_info: {
          tag: 'NEW',
          rank: 1,
          description: '스마트 무빙 파우셋 탑재',
        },
        values: {
          form_factor: '데스크형',
          purification_type: '직수형',
          purifier_functions: '냉온정',
          filter_method: null,
          color_info: [{ color_code: '#FFFFFF', color_name: '퓨어 화이트' }],
        },
        thumbnails: [
          {
            id: 1,
            goods_id: 3301,
            url: 'https://example.com/thumb.png',
            index: 1,
            type: 'thumbnail',
          },
        ],
        images: [
          {
            id: 2,
            goods_id: 3301,
            url: 'https://example.com/detail.png',
            index: 1,
            type: 'image',
          },
        ],
        stocks: [
          {
            id: 3310,
            goods_id: 3301,
            serial: 'CHP-7220N',
            product_name: '아이콘3',
            is_recommended: true,
            values: {
              payback: { cash: 300000 },
              color_code: '#FFFFFF',
              monthly_fee: 28900,
              card_discount: 19000,
              rental_period: 84,
              maintenance_type: 'visit',
              commitment_period: 36,
              maintenance_period: 4,
            },
          },
        ],
      },
    ] satisfies MisoDirectoryGoodsResponse[]);

    expect(catalog.productsCount).toBe(1);
    expect(catalog.offersCount).toBe(1);
    expect(catalog.products[0]).toMatchObject({
      goodsCode: 'CHP-7220N',
      brandName: '코웨이',
      productName: '아이콘3',
      featureTags: ['냉수', '온수', '정수'],
      metadata: {
        listingRank: 1,
        listingTag: 'NEW',
        formFactor: '데스크형',
      },
    });
    expect(catalog.products[0].offers[0]).toMatchObject({
      serial: 'CHP-7220N',
      managementType: 'visit',
      contractTermMonths: 84,
      publicMonthlyFee: 28900,
      cardAppliedMonthlyFee: 9900,
      supportPricingModel: 'fixed_public',
      supportAmount: 300000,
      metadata: {
        benefitEvidence: 'api_payback',
      },
    });
  });

  it('treats missing payback as quote-required support pricing', () => {
    const catalog = mapMisoGoodsToCatalog([
      {
        id: 2937,
        brand: 'SK매직',
        goods_code: 'WPUJAC104S',
        goods_type: 'water_purifier',
        name: '초소형 직수',
        popularity: 1,
        rank_info: null,
        values: {
          form_factor: '데스크형',
          purification_type: '직수형',
          purifier_functions: '냉온정',
          filter_method: null,
          color_info: [],
        },
        thumbnails: [],
        images: [],
        stocks: [
          {
            id: 3001,
            goods_id: 2937,
            serial: 'WPUJAC104S',
            product_name: '초소형 직수',
            is_recommended: false,
            values: {
              payback: null,
              color_code: '#F4F1F0',
              monthly_fee: 27400,
              card_discount: 17000,
              rental_period: 84,
              maintenance_type: 'self',
              commitment_period: 36,
              maintenance_period: 4,
            },
          },
        ],
      },
    ] satisfies MisoDirectoryGoodsResponse[]);

    expect(catalog.products[0].offers[0]).toMatchObject({
      supportPricingModel: 'quote_required',
      supportAmount: null,
      supportAmountMin: null,
      supportAmountMax: null,
      metadata: {
        benefitEvidence: 'consult_required_copy',
      },
    });
  });

  it('keeps term-specific fee and payback differences as separate offers', () => {
    const catalog = mapMisoGoodsToCatalog([
      {
        id: 2939,
        brand: '코웨이',
        goods_code: 'CHPI-7521L',
        goods_type: 'water_purifier',
        name: '아이스 스탠드 자이언트',
        popularity: 1,
        rank_info: null,
        values: {
          form_factor: '스탠드형',
          purification_type: '직수형',
          purifier_functions: '얼음 냉온정',
          filter_method: null,
          color_info: [],
        },
        thumbnails: [],
        images: [],
        stocks: [
          {
            id: 9011,
            goods_id: 2939,
            serial: 'CHPI-7521L-60',
            product_name: '아이스 스탠드 자이언트',
            is_recommended: false,
            values: {
              payback: { cash: 380000 },
              monthly_fee: 58900,
              rental_period: 60,
              maintenance_type: 'visit',
            },
          },
          {
            id: 9012,
            goods_id: 2939,
            serial: 'CHPI-7521L-72',
            product_name: '아이스 스탠드 자이언트',
            is_recommended: false,
            values: {
              payback: { cash: 450000 },
              monthly_fee: 54900,
              rental_period: 72,
              maintenance_type: 'visit',
            },
          },
        ],
      },
    ] satisfies MisoDirectoryGoodsResponse[]);

    const offers = catalog.products[0].offers;
    expect(offers).toHaveLength(2);

    const byTerm = new Map(offers.map((offer) => [offer.contractTermMonths, offer]));
    expect(byTerm.get(60)).toMatchObject({
      publicMonthlyFee: 58900,
      supportAmount: 380000,
      supportPricingModel: 'fixed_public',
      metadata: { benefitEvidence: 'api_payback' },
    });
    expect(byTerm.get(72)).toMatchObject({
      publicMonthlyFee: 54900,
      supportAmount: 450000,
      supportPricingModel: 'fixed_public',
      metadata: { benefitEvidence: 'api_payback' },
    });
  });
});

describe('extractMisoNextPageProps', () => {
  it('extracts page props from __NEXT_DATA__ html', () => {
    const html = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {"props":{"pageProps":{"rentalRecommendProducts":[{"goods_code":"CHP-7220N"}],"filterOptions":{"brand":["코웨이"]}}}}
          </script>
        </body>
      </html>
    `;

    expect(extractMisoNextPageProps(html)).toEqual({
      rentalRecommendProducts: [{ goods_code: 'CHP-7220N' }],
      filterOptions: { brand: ['코웨이'] },
    });
  });
});
