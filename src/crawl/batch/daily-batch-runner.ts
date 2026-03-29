import path from 'node:path';

import { buildChannelQualityMetrics, detectChannelDrift } from './drift-detector';
import type {
  BatchCsvWriteResult,
  BatchRunStatus,
  BatchTriggerType,
  ChannelCatalogData,
  ChannelQualityMetrics,
  ChannelSlug,
  DriftDetectionResult,
} from './batch.types';
import { writeBatchCsvFiles } from './batch-csv-manager';

export interface BatchRunRecord {
  id: string;
  triggerType: BatchTriggerType;
  startedAt: string;
  finishedAt: string | null;
  status: BatchRunStatus;
}

export interface ChannelRunRecord {
  id: string;
  batchRunId: string;
  channel: ChannelSlug;
  startedAt: string;
  finishedAt: string | null;
  status: BatchRunStatus;
}

export interface ChannelMetricsHistory extends ChannelQualityMetrics {}

export interface ChannelBatchExecution {
  catalog: ChannelCatalogData;
}

export interface ChannelExecutor {
  channel: ChannelSlug;
  execute: () => Promise<ChannelBatchExecution>;
}

export interface FinishChannelRunInput {
  status: BatchRunStatus;
  metrics?: ChannelQualityMetrics;
  drift?: DriftDetectionResult;
  itemsDiscovered?: number;
  itemsUpserted?: number;
  itemsFailed?: number;
  errorMessage?: string | null;
}

export interface FinishBatchRunInput {
  status: BatchRunStatus;
  latestProductsCsvPath: string;
  latestOffersCsvPath: string;
  archivedProductsCsvPath: string | null;
  archivedOffersCsvPath: string | null;
  summary: Record<string, unknown>;
}

export interface DailyBatchRepository {
  createBatchRun(triggerType?: BatchTriggerType): Promise<BatchRunRecord>;
  createChannelRun(channel: ChannelSlug, batchRunId?: string): Promise<ChannelRunRecord>;
  getPreviousChannelMetrics(channel: ChannelSlug): Promise<ChannelMetricsHistory | null>;
  writeChannelSnapshots(
    channel: ChannelSlug,
    crawlRunId?: string,
    catalog?: ChannelCatalogData,
    metrics?: ChannelQualityMetrics,
    drift?: DriftDetectionResult,
  ): Promise<void>;
  replaceCurrentChannelData(
    channel: ChannelSlug,
    crawlRunId?: string,
    catalog?: ChannelCatalogData,
  ): Promise<void>;
  finishChannelRun(
    channel: ChannelSlug,
    status: BatchRunStatus,
    input?: FinishChannelRunInput,
  ): Promise<void>;
  listCurrentProducts(): Promise<ChannelCatalogData['products']>;
  listCurrentOffers(): Promise<ChannelCatalogData['offers']>;
  finishBatchRun(status: BatchRunStatus, input?: FinishBatchRunInput): Promise<void>;
}

export interface DailyBatchRunnerDependencies {
  repository: DailyBatchRepository;
  channelExecutors: readonly ChannelExecutor[];
  writeCsvFiles?: (input: {
    outputDir: string;
    fetchedAt: string;
    products: ChannelCatalogData['products'];
    offers: ChannelCatalogData['offers'];
    shouldArchive: boolean;
  }) => Promise<BatchCsvWriteResult>;
  outputDir?: string;
}

export interface DailyBatchRunnerResult {
  status: BatchRunStatus;
  batchRunId: string;
  latestProductsCsvPath: string;
  latestOffersCsvPath: string;
  archivedProductsCsvPath: string | null;
  archivedOffersCsvPath: string | null;
}

export class DailyBatchRunner {
  private readonly writeCsvFiles: NonNullable<DailyBatchRunnerDependencies['writeCsvFiles']>;
  private readonly outputDir: string;

  constructor(private readonly dependencies: DailyBatchRunnerDependencies) {
    this.writeCsvFiles = dependencies.writeCsvFiles ?? writeBatchCsvFiles;
    this.outputDir =
      dependencies.outputDir ?? path.join(process.cwd(), 'exports', 'water-purifier');
  }

  async run(input: { triggerType: BatchTriggerType }): Promise<DailyBatchRunnerResult> {
    const batchRun = await this.dependencies.repository.createBatchRun(input.triggerType);
    let successChannelCount = 0;
    let failedChannelCount = 0;
    let warningChannelCount = 0;

    for (const executor of this.dependencies.channelExecutors) {
      const channelRun = await this.dependencies.repository.createChannelRun(executor.channel, batchRun.id);

      try {
        const execution = await executor.execute();
        const metrics = buildChannelQualityMetrics(execution.catalog.offers);
        const previousMetrics = await this.dependencies.repository.getPreviousChannelMetrics(
          executor.channel,
        );
        const drift = detectChannelDrift(executor.channel, {
          previous: previousMetrics,
          current: metrics,
        });
        const shouldPromoteCurrent = drift.status !== 'critical';
        const status: BatchRunStatus = shouldPromoteCurrent ? 'success' : 'partial_success';

        await this.dependencies.repository.writeChannelSnapshots(
          executor.channel,
          channelRun.id,
          execution.catalog,
          metrics,
          drift,
        );

        if (shouldPromoteCurrent) {
          await this.dependencies.repository.replaceCurrentChannelData(
            executor.channel,
            channelRun.id,
            execution.catalog,
          );
          successChannelCount += 1;
        } else {
          warningChannelCount += 1;
        }

        if (drift.status === 'warning' || drift.status === 'informational') {
          warningChannelCount += 1;
        }

        await this.dependencies.repository.finishChannelRun(executor.channel, status, {
          status,
          metrics,
          drift,
          itemsDiscovered: execution.catalog.offers.length,
          itemsUpserted: shouldPromoteCurrent ? execution.catalog.offers.length : 0,
          itemsFailed: shouldPromoteCurrent ? 0 : execution.catalog.offers.length,
        });
      } catch (error) {
        failedChannelCount += 1;
        await this.dependencies.repository.finishChannelRun(executor.channel, 'failed', {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const products = await this.dependencies.repository.listCurrentProducts();
    const offers = await this.dependencies.repository.listCurrentOffers();
    const shouldArchive = failedChannelCount > 0 || warningChannelCount > 0;
    const csvFiles = await this.writeCsvFiles({
      outputDir: this.outputDir,
      fetchedAt: new Date().toISOString(),
      products,
      offers,
      shouldArchive,
    });
    const totalChannelCount = this.dependencies.channelExecutors.length;
    const status =
      successChannelCount === 0
        ? 'failed'
        : failedChannelCount > 0 || warningChannelCount > 0
          ? 'partial_success'
          : 'success';

    await this.dependencies.repository.finishBatchRun(status, {
      status,
      latestProductsCsvPath: csvFiles.latestProductsCsvPath,
      latestOffersCsvPath: csvFiles.latestOffersCsvPath,
      archivedProductsCsvPath: csvFiles.archivedProductsCsvPath,
      archivedOffersCsvPath: csvFiles.archivedOffersCsvPath,
      summary: {
        totalChannelCount,
        successChannelCount,
        failedChannelCount,
        warningChannelCount,
        productCount: products.length,
        offerCount: offers.length,
      },
    });

    return {
      status,
      batchRunId: batchRun.id,
      latestProductsCsvPath: csvFiles.latestProductsCsvPath,
      latestOffersCsvPath: csvFiles.latestOffersCsvPath,
      archivedProductsCsvPath: csvFiles.archivedProductsCsvPath,
      archivedOffersCsvPath: csvFiles.archivedOffersCsvPath,
    };
  }
}

export type {
  BatchCsvWriteResult,
  ChannelCatalogData,
};
