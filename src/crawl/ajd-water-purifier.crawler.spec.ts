import {
  extractAjdRankingItemBlocks,
  mergeAjdProductWithDetailPayload,
  parseAjdDetailPayload,
  parseAjdRankingCatalog,
  parseAjdRankingPayloadProducts,
} from './ajd-water-purifier.crawler';

function wrapAjdNuxtPayload(payload: unknown[]): string {
  return `<html><body><script data-nuxt-data>${JSON.stringify(payload)}</script></body></html>`;
}

function buildAjdNuxtHtml(
  dataEntries: Record<string, unknown>,
  path: string = '/',
): string {
  const payload: unknown[] = [null];

  const entry = (value: unknown): number => {
    const index = payload.length;
    payload.push(value);
    return index;
  };

  const encode = (value: unknown): number => {
    const index = payload.length;
    payload.push(null);

    if (Array.isArray(value)) {
      payload[index] = value.map((item) => encode(item));
      return index;
    }

    if (value && typeof value === 'object') {
      payload[index] = Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, encode(child)]),
      );
      return index;
    }

    payload[index] = value;
    return index;
  };

  const dataObjectRef = encode(dataEntries);
  const dataRef = entry(['ShallowReactive', dataObjectRef]);
  const rootRef = entry({
    data: dataRef,
    state: entry({}),
    once: entry({}),
    _errors: entry({}),
    serverRendered: entry(true),
    path: entry(path),
    pinia: entry({}),
  });

  payload[0] = ['ShallowReactive', rootRef];

  return wrapAjdNuxtPayload(payload);
}

function buildAjdDetailPayloadHtml(): string {
  return buildAjdNuxtHtml(
    {
      'rental-detail-52378': {
        sn: 52378,
        lowerCategorySn: 4020,
        reviewCount: 0,
        averageScore: 98.8,
        recommendLabel: '강력추천! 아정당렌탈 단독 혜택!',
        chargeList: [
          {
            contractPeriod: 60,
            children: [
              {
                name: '관리없음',
                children: [
                  {
                    sn: 92426,
                    companyName: '아정당렌탈',
                    contractPeriod: 60,
                    managementCycle: '필터포함 및 A/S무상',
                    managementType: 'sys:productConfig:managementType:none',
                    firstCharge: 34900,
                    installCharge: 0,
                  },
                ],
              },
            ],
          },
          {
            contractPeriod: 48,
            children: [
              {
                name: '관리없음',
                children: [
                  {
                    sn: 92425,
                    companyName: '아정당렌탈',
                    contractPeriod: 48,
                    managementCycle: '필터포함 및 A/S무상',
                    managementType: 'sys:productConfig:managementType:none',
                    firstCharge: 42900,
                    installCharge: 0,
                  },
                ],
              },
            ],
          },
          {
            contractPeriod: 36,
            children: [
              {
                name: '관리없음',
                children: [
                  {
                    sn: 92424,
                    companyName: '아정당렌탈',
                    contractPeriod: 36,
                    managementCycle: '필터포함 및 A/S무상',
                    managementType: 'sys:productConfig:managementType:none',
                    firstCharge: 56200,
                    installCharge: 0,
                  },
                ],
              },
            ],
          },
        ],
        cardList: [
          {
            name: '뉴렌탈플러스 하나카드',
            discountAmount: 13000,
          },
        ],
      },
    },
    '/electronics/overview/4020/detail/52378',
  );
}

describe('parseAjdRankingCatalog', () => {
  it('maps ranking cards into products and hidden support offers', () => {
    const html = `
      <html>
        <head>
          <title>아정당 정수기렌탈 현금 지원금 최대 30만원 설치 당일 지급</title>
        </head>
        <body>
          <section class="bbs-info row">
            <div class="bbs-title row" id="bbs-total-count">
              <h4 class="bbs-category-title">정수기 추천 제품</h4>
              <p class="total-amount"> 총 <span class="value">175</span> 건 </p>
            </div>
          </section>
          <section class="ranking-list-section" id="ranking-list-section">
            <div class="product-list-wrap">
              <div class="item ranking-list-item">
                <div class="inner">
                  <div class="img-box">
                    <a class="img">
                      <span class="top ranking-badge">1</span>
                      <img src="https://image.ajd.kr/PRODUCT_CODE/example-1" alt="삼성 2025 비스포크 AI 냉온정수기" loading="lazy" class="">
                    </a>
                    <div class="product-type row">
                      <div class="purifier-type3"><span class="icon"></span><span class="value">냉수</span></div>
                      <div class="purifier-type4"><span class="icon"></span><span class="value">온수</span></div>
                      <div class="purifier-type2"><span class="icon"></span><span class="value">정수</span></div>
                    </div>
                  </div>
                  <div class="txt-box">
                    <div class="top row">
                      <div class="info">
                        <div class="product-score row">
                          <div class="total-score">
                            <span class="value"><small>종합점수</small><br>95.3</span>
                          </div>
                        </div>
                        <div class="product-name">
                          <div class="brand">삼성</div>
                          <div class="name">삼성 2025 비스포크 AI 냉온정수기</div>
                          <small class="detail-name">RWP70F15AN</small>
                        </div>
                      </div>
                      <div class="product-price-box">
                        <p class="product-price-box__monthly">월 34,900원</p>
                        <p class="product-price-box__card-discount"><span class="product-price-box__card-discount__label">카드할인시</span> 월 21,900원</p>
                      </div>
                    </div>
                    <div class="product-text-badge row">
                      <span>위생기능 170위</span>
                    </div>
                    <div class="product-spec row">
                      <div class="wrap">
                        <h6>주요 스펙</h6>
                        <div class="spec-list-wrap row">
                          <div class="spec-list"><span>제품유형</span><p><strong>데스크형</strong></p></div>
                          <div class="spec-list"><span>정수타입</span><p><strong>직수형</strong></p></div>
                        </div>
                      </div>
                      <div class="wrap">
                        <h6>점수 구성</h6>
                        <div class="individual-score row">
                          <div class="score-option"><span class="label">정수성능</span><span class="blue value score-dot">96.0</span></div>
                          <div class="score-option"><span class="label">위생관리</span><span class="blue value score-dot">95.7</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <a class="compare-btn"><span class="btn-text">비교하기</span></a>
                </div>
                <div class="ranking-divider"></div>
              </div>
              <div class="item ranking-list-item">
                <div class="inner">
                  <div class="img-box">
                    <a class="img">
                      <span class="ranking-badge">2</span>
                      <img src="https://image.ajd.kr/PRODUCT_CODE/example-2" alt="쿠쿠 STEAM 100도씨 끓인물 정수기 (냉온정)" loading="lazy" class="">
                    </a>
                  </div>
                  <div class="txt-box">
                    <div class="top row">
                      <div class="info">
                        <div class="product-name">
                          <div class="brand">쿠쿠</div>
                          <div class="name">쿠쿠 STEAM 100도씨 끓인물 정수기 (냉온정)</div>
                          <small class="detail-name">CP-ABS100G</small>
                        </div>
                      </div>
                      <div class="product-price-box">
                        <p class="product-price-box__monthly">월 28,900원</p>
                        <p class="product-price-box__card-discount"><span class="product-price-box__card-discount__label">카드할인시</span> 월 3,900원</p>
                      </div>
                    </div>
                    <div class="product-spec row">
                      <div class="wrap">
                        <h6>점수 구성</h6>
                        <div class="individual-score row">
                          <div class="score-option"><span class="label">정수성능</span><span class="blue value score-dot">100.0</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p class="review"><span class="label">구매 후기 </span><span class="value">548건</span></p>
                  <a class="compare-btn"><span class="btn-text">비교하기</span></a>
                </div>
                <div class="ranking-divider"></div>
              </div>
            </div>
          </section>
        </body>
      </html>
    `;

    const catalog = parseAjdRankingCatalog(html, '2026-03-27T00:00:00.000Z');

    expect(catalog.pageTotalCount).toBe(175);
    expect(catalog.productsCount).toBe(2);
    expect(catalog.products[0]).toMatchObject({
      rankingRank: 1,
      brandName: '삼성',
      productName: '삼성 2025 비스포크 AI 냉온정수기',
      modelCode: 'RWP70F15AN',
      featureTags: ['냉수', '온수', '정수'],
      metadata: {
        totalScore: 95.3,
        reviewCount: null,
        textBadges: ['위생기능 170위'],
        specifications: {
          제품유형: '데스크형',
          정수타입: '직수형',
        },
        scoreBreakdown: {
          정수성능: 96,
          위생관리: 95.7,
        },
      },
    });
    expect(catalog.products[0].offers[0]).toMatchObject({
      publicMonthlyFee: 34900,
      cardAppliedMonthlyFee: 21900,
      supportPricingModel: 'hidden',
      metadata: {
        benefitEvidence: 'not_exposed_in_ranking',
      },
    });
    expect(catalog.products[1].metadata.reviewCount).toBe(548);
  });
});

describe('extractAjdRankingItemBlocks', () => {
  it('extracts item blocks from the ranking section', () => {
    const html = `
      <section class="ranking-list-section" id="ranking-list-section">
        <div class="item ranking-list-item">first<div class="ranking-divider"></div></div>
        <div class="item ranking-list-item">second<div class="ranking-divider"></div></div>
      </section>
    `;

    expect(extractAjdRankingItemBlocks(html)).toHaveLength(2);
  });
});

describe('parseAjdRankingPayloadProducts', () => {
  it('extracts detail identifiers from nuxt ranking payload', () => {
    const html = buildAjdNuxtHtml(
      {
        'rental-ranking-list': {
          content: [
            {
              sn: 52378,
              lowerCategorySn: 4020,
              rankingNumber: 1,
              name: '삼성 2025 비스포크 AI 냉온정수기',
              modelName: 'RWP70F15AN',
              brandName: '삼성',
            },
          ],
        },
      },
      '/electronics/overview/2010-4020/ranking',
    );

    expect(parseAjdRankingPayloadProducts(html)).toEqual([
      {
        sn: 52378,
        lowerCategorySn: 4020,
        rankingNumber: 1,
        name: '삼성 2025 비스포크 AI 냉온정수기',
        modelName: 'RWP70F15AN',
        brandName: '삼성',
      },
    ]);
  });
});

describe('parseAjdDetailPayload', () => {
  it('extracts contract-term charge options and card discounts from nuxt detail payload', () => {
    const html = buildAjdDetailPayloadHtml();

    const detailPayload = parseAjdDetailPayload(html);

    expect(detailPayload).toMatchObject({
      detailSn: 52378,
      lowerCategorySn: 4020,
      averageScore: 98.8,
      cards: [
        {
          name: '뉴렌탈플러스 하나카드',
          discountAmount: 13000,
        },
      ],
    });
    expect(detailPayload?.chargeOptions).toEqual([
      {
        sn: 92424,
        companyName: '아정당렌탈',
        contractTermMonths: 36,
        managementLabel: '관리없음',
        managementCycle: '필터포함 및 A/S무상',
        rawManagementType: 'sys:productConfig:managementType:none',
        publicMonthlyFee: 56200,
        installCharge: 0,
      },
      {
        sn: 92425,
        companyName: '아정당렌탈',
        contractTermMonths: 48,
        managementLabel: '관리없음',
        managementCycle: '필터포함 및 A/S무상',
        rawManagementType: 'sys:productConfig:managementType:none',
        publicMonthlyFee: 42900,
        installCharge: 0,
      },
      {
        sn: 92426,
        companyName: '아정당렌탈',
        contractTermMonths: 60,
        managementLabel: '관리없음',
        managementCycle: '필터포함 및 A/S무상',
        rawManagementType: 'sys:productConfig:managementType:none',
        publicMonthlyFee: 34900,
        installCharge: 0,
      },
    ]);
  });
});

describe('mergeAjdProductWithDetailPayload', () => {
  it('expands one ranking product into contract-term offers', () => {
    const detailPayload = parseAjdDetailPayload(buildAjdDetailPayloadHtml());

    const enrichedProduct = mergeAjdProductWithDetailPayload(
      {
        externalProductId: 'ajd:RWP70F15AN',
        rankingRank: 1,
        brandName: '삼성',
        productName: '삼성 2025 비스포크 AI 냉온정수기',
        modelCode: 'RWP70F15AN',
        detailUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
        thumbnailUrl: 'https://image.ajd.kr/example',
        featureTags: ['냉수', '온수', '정수'],
        metadata: {
          totalScore: 95.3,
          reviewCount: null,
          textBadges: ['위생기능 170위'],
          specifications: {
            제품유형: '데스크형',
          },
          scoreBreakdown: {
            정수성능: 96,
          },
        },
        offers: [
          {
            externalOfferId: 'ajd:RWP70F15AN:rank:1',
            offerName: '삼성 삼성 2025 비스포크 AI 냉온정수기',
            publicOfferUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
            managementType: null,
            contractTermMonths: null,
            publicMonthlyFee: 34900,
            cardAppliedMonthlyFee: 21900,
            supportPricingModel: 'hidden',
            supportAmount: null,
            supportAmountMin: null,
            supportAmountMax: null,
            metadata: {
              rankingRank: 1,
              benefitEvidence: 'not_exposed_in_ranking',
            },
          },
        ],
      },
      detailPayload!,
    );

    expect(enrichedProduct.detailUrl).toBe(
      'https://www.ajd.co.kr/electronics/overview/4020/detail/52378',
    );
    expect(enrichedProduct.metadata).toMatchObject({
      detailSn: 52378,
      lowerCategorySn: 4020,
      detailAverageScore: 98.8,
    });
    expect(enrichedProduct.offers).toHaveLength(3);
    expect(enrichedProduct.offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contractTermMonths: 60,
          managementType: 'self',
          publicMonthlyFee: 34900,
          cardAppliedMonthlyFee: 21900,
          metadata: expect.objectContaining({
            cardNames: ['뉴렌탈플러스 하나카드'],
            cardCompanies: ['하나카드'],
          }),
        }),
        expect.objectContaining({
          contractTermMonths: 48,
          managementType: 'self',
          publicMonthlyFee: 42900,
          cardAppliedMonthlyFee: 29900,
        }),
        expect.objectContaining({
          contractTermMonths: 36,
          managementType: 'self',
          publicMonthlyFee: 56200,
          cardAppliedMonthlyFee: 43200,
        }),
      ]),
    );
  });
});
