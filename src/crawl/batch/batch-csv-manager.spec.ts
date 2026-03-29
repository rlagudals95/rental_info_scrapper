import os from 'node:os';
import path from 'node:path';

import { mkdtemp, readFile } from 'node:fs/promises';

import { writeBatchCsvFiles } from './batch-csv-manager';
import type { CurrentCrawledOfferRow, CurrentCrawledProductRow } from './channel-catalog.mapper';

describe('writeBatchCsvFiles', () => {
  it('writes latest csv files and skips archive for clean success runs', async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'batch-csv-'));
    const products: CurrentCrawledProductRow[] = [
      {
        channel: 'ajd',
        externalProductId: 'ajd:1',
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
        brandName: '코웨이',
        productName: '아이콘',
        modelCode: 'CHPI-7400N',
        detailUrl: 'https://www.ajd.co.kr/electronics/overview/4020/detail/1',
        thumbnailUrl: null,
        featureTags: ['냉수', '정수'],
        offerCount: 1,
        rating: null,
        reviewCount: 12,
        orderCount: null,
        rankingRank: 1,
        metadata: {},
      },
    ];
    const offers: CurrentCrawledOfferRow[] = [
      {
        channel: 'ajd',
        externalOfferId: 'ajd:1:offer:1',
        externalProductId: 'ajd:1',
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl: 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking',
        brandName: '코웨이',
        productName: '아이콘',
        modelCode: 'CHPI-7400N',
        productDetailUrl: 'https://www.ajd.co.kr/electronics/overview/4020/detail/1',
        offerUrl: 'https://www.ajd.co.kr/electronics/overview/4020/detail/1',
        publicMonthlyFee: 30900,
        cardAppliedMonthlyFee: 15900,
        cardDiscountAmount: 15000,
        hasAffiliateCard: true,
        primaryCardCompany: '롯데카드',
        primaryCardName: '렌탈 롯데카드',
        cardCompanies: ['롯데카드'],
        cardNames: ['렌탈 롯데카드'],
        contractTermMonths: 60,
        obligationTermMonths: 60,
        ownershipTransferMonths: null,
        managementType: 'visit',
        maintenanceCycleMonths: 4,
        maintenancePeriodMonths: 4,
        commitmentPeriodMonths: 60,
        promoDurationMonths: null,
        postPromoMonthlyFee: null,
        supportPricingModel: 'hidden',
        supportAmount: null,
        supportAmountMin: null,
        supportAmountMax: null,
        rating: null,
        reviewCount: 12,
        orderCount: null,
        rankingRank: 1,
        featureTags: ['냉수', '정수'],
        metadata: {},
      },
    ];

    const result = await writeBatchCsvFiles({
      outputDir,
      fetchedAt: '2026-03-28T00:00:00.000Z',
      products,
      offers,
      shouldArchive: false,
    });

    expect(result.latestProductsCsvPath).toContain('latest-products.csv');
    expect(result.latestOffersCsvPath).toContain('latest-offers.csv');
    expect(result.archivedProductsCsvPath).toBeNull();
    expect(result.archivedOffersCsvPath).toBeNull();

    const latestOffersCsv = await readFile(result.latestOffersCsvPath, 'utf8');
    expect(latestOffersCsv).toContain('external_offer_id');
    expect(latestOffersCsv).toContain('ajd:1:offer:1');
  });

  it('writes timestamped archive files for incident runs', async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'batch-csv-'));

    const result = await writeBatchCsvFiles({
      outputDir,
      fetchedAt: '2026-03-28T01:23:45.678Z',
      products: [],
      offers: [],
      shouldArchive: true,
    });

    expect(result.archivedProductsCsvPath).toContain('2026-03-28T01-23-45-678Z-products.csv');
    expect(result.archivedOffersCsvPath).toContain('2026-03-28T01-23-45-678Z-offers.csv');
  });
});
