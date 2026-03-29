import type {
  BatchCsvWriteResult,
  BatchRunRecord,
  ChannelBatchExecution,
  ChannelCatalogData,
  ChannelMetricsHistory,
  ChannelRunRecord,
  DailyBatchRepository,
} from './daily-batch-runner';
import { DailyBatchRunner } from './daily-batch-runner';

function createBatchRun(status: BatchRunRecord['status'] = 'running'): BatchRunRecord {
  return {
    id: 'batch-1',
    triggerType: 'manual',
    startedAt: '2026-03-28T00:00:00.000Z',
    finishedAt: null,
    status,
  };
}

function createChannelRun(channel: ChannelRunRecord['channel']): ChannelRunRecord {
  return {
    id: `crawl-${channel}`,
    batchRunId: 'batch-1',
    channel,
    startedAt: '2026-03-28T00:00:00.000Z',
    finishedAt: null,
    status: 'running',
  };
}

function createCatalog(channel: 'ajd' | 'miso' | 'rentre'): ChannelCatalogData {
  return {
    products: [
      {
        channel,
        externalProductId: `${channel}:product-1`,
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl:
          channel === 'ajd'
            ? 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking'
            : channel === 'miso'
              ? 'https://miso.kr/booking/rental/water_purifier'
              : 'https://rentre.kr/water-purifier',
        brandName: '코웨이',
        productName: '아이콘',
        modelCode: 'CHPI-7400N',
        detailUrl: 'https://example.com/product-1',
        thumbnailUrl: null,
        featureTags: ['냉수'],
        offerCount: 1,
        rating: null,
        reviewCount: 10,
        orderCount: null,
        rankingRank: channel === 'rentre' ? null : 1,
        metadata: {},
      },
    ],
    offers: [
      {
        channel,
        externalOfferId: `${channel}:offer-1`,
        externalProductId: `${channel}:product-1`,
        fetchedAt: '2026-03-28T00:00:00.000Z',
        sourceUrl:
          channel === 'ajd'
            ? 'https://www.ajd.co.kr/electronics/overview/2010-4020/ranking'
            : channel === 'miso'
              ? 'https://miso.kr/booking/rental/water_purifier'
              : 'https://rentre.kr/water-purifier',
        brandName: '코웨이',
        productName: '아이콘',
        modelCode: 'CHPI-7400N',
        productDetailUrl: 'https://example.com/product-1',
        offerUrl: 'https://example.com/product-1',
        publicMonthlyFee: 30900,
        cardAppliedMonthlyFee: 15900,
        cardDiscountAmount: 15000,
        hasAffiliateCard: true,
        primaryCardCompany: channel === 'miso' ? null : '롯데카드',
        primaryCardName: channel === 'miso' ? null : '렌탈 롯데카드',
        cardCompanies: channel === 'miso' ? [] : ['롯데카드'],
        cardNames: channel === 'miso' ? [] : ['렌탈 롯데카드'],
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
        reviewCount: 10,
        orderCount: null,
        rankingRank: channel === 'rentre' ? null : 1,
        featureTags: ['냉수'],
        metadata: {},
      },
    ],
  };
}

class FakeRepository implements DailyBatchRepository {
  public snapshotsWritten: string[] = [];
  public currentPromotions: string[] = [];
  public crawlRunFinishes: Array<{ channel: string; status: string }> = [];
  public batchFinishStatus: BatchRunRecord['status'] | null = null;

  constructor(
    private readonly metricsByChannel: Partial<Record<'ajd' | 'miso' | 'rentre', ChannelMetricsHistory>>,
  ) {}

  async createBatchRun(): Promise<BatchRunRecord> {
    return createBatchRun();
  }

  async createChannelRun(channel: ChannelRunRecord['channel']): Promise<ChannelRunRecord> {
    return createChannelRun(channel);
  }

  async getPreviousChannelMetrics(
    channel: ChannelRunRecord['channel'],
  ): Promise<ChannelMetricsHistory | null> {
    return this.metricsByChannel[channel] ?? null;
  }

  async writeChannelSnapshots(channel: ChannelRunRecord['channel']): Promise<void> {
    this.snapshotsWritten.push(channel);
  }

  async replaceCurrentChannelData(channel: ChannelRunRecord['channel']): Promise<void> {
    this.currentPromotions.push(channel);
  }

  async finishChannelRun(
    channel: ChannelRunRecord['channel'],
    status: ChannelRunRecord['status'],
  ): Promise<void> {
    this.crawlRunFinishes.push({ channel, status });
  }

  async listCurrentProducts() {
    return [createCatalog('ajd').products[0], createCatalog('miso').products[0]];
  }

  async listCurrentOffers() {
    return [createCatalog('ajd').offers[0], createCatalog('miso').offers[0]];
  }

  async finishBatchRun(status: BatchRunRecord['status']): Promise<void> {
    this.batchFinishStatus = status;
  }
}

describe('DailyBatchRunner', () => {
  it('keeps previous current data for failed channels and archives incident csv', async () => {
    const repository = new FakeRepository({
      ajd: {
        offersCount: 1,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 1,
        affiliateCardCompanyFilledCount: 1,
        affiliateCardNameFilledCount: 1,
      },
    });
    const csvResults: BatchCsvWriteResult[] = [];
    const runner = new DailyBatchRunner({
      repository,
      channelExecutors: [
        {
          channel: 'ajd',
          execute: async (): Promise<ChannelBatchExecution> => ({
            catalog: createCatalog('ajd'),
          }),
        },
        {
          channel: 'miso',
          execute: async (): Promise<ChannelBatchExecution> => {
            throw new Error('miso timeout');
          },
        },
      ],
      writeCsvFiles: async (input) => {
        const result: BatchCsvWriteResult = {
          latestProductsCsvPath: '/tmp/latest-products.csv',
          latestOffersCsvPath: '/tmp/latest-offers.csv',
          archivedProductsCsvPath: input.shouldArchive ? '/tmp/archive-products.csv' : null,
          archivedOffersCsvPath: input.shouldArchive ? '/tmp/archive-offers.csv' : null,
        };
        csvResults.push(result);
        return result;
      },
    });

    const result = await runner.run({ triggerType: 'manual' });

    expect(repository.snapshotsWritten).toEqual(['ajd']);
    expect(repository.currentPromotions).toEqual(['ajd']);
    expect(repository.crawlRunFinishes).toEqual(
      expect.arrayContaining([
        { channel: 'ajd', status: 'success' },
        { channel: 'miso', status: 'failed' },
      ]),
    );
    expect(repository.batchFinishStatus).toBe('partial_success');
    expect(result.status).toBe('partial_success');
    expect(csvResults[0]?.archivedOffersCsvPath).toBe('/tmp/archive-offers.csv');
  });

  it('skips current promotion when drift is critical', async () => {
    const repository = new FakeRepository({
      rentre: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 100,
        affiliateCardCompanyFilledCount: 100,
        affiliateCardNameFilledCount: 100,
      },
    });
    const runner = new DailyBatchRunner({
      repository,
      channelExecutors: [
        {
          channel: 'rentre',
          execute: async (): Promise<ChannelBatchExecution> => ({
            catalog: {
              ...createCatalog('rentre'),
              offers: createCatalog('rentre').offers.map((offer, index) => ({
                ...offer,
                externalOfferId: `rentre:offer-${index + 1}`,
              })),
            },
          }),
        },
      ],
      writeCsvFiles: async () => ({
        latestProductsCsvPath: '/tmp/latest-products.csv',
        latestOffersCsvPath: '/tmp/latest-offers.csv',
        archivedProductsCsvPath: '/tmp/archive-products.csv',
        archivedOffersCsvPath: '/tmp/archive-offers.csv',
      }),
    });

    await runner.run({ triggerType: 'manual' });

    expect(repository.snapshotsWritten).toEqual(['rentre']);
    expect(repository.currentPromotions).toEqual([]);
    expect(repository.crawlRunFinishes).toEqual([{ channel: 'rentre', status: 'partial_success' }]);
  });
});
