import {
  crawlAjdWaterPurifierCatalog,
} from './ajd-water-purifier.crawler';
import { PgDailyBatchRepository } from './batch/batch-run.repository';
import { mapChannelCatalogToCurrentRows } from './batch/channel-catalog.mapper';
import { DailyBatchRunner } from './batch/daily-batch-runner';
import { closePgPool } from '../db/pg-client';
import { crawlMisoWaterPurifierCatalog } from './miso-water-purifier.crawler';
import { crawlRentreWaterPurifierCatalog } from './rentre-water-purifier.crawler';

function resolveTriggerType(): 'scheduled' | 'manual' {
  return process.argv.includes('--scheduled') ? 'scheduled' : 'manual';
}

async function main(): Promise<void> {
  try {
    const runner = new DailyBatchRunner({
      repository: new PgDailyBatchRepository(),
      channelExecutors: [
        {
          channel: 'ajd',
          execute: async () => ({
            catalog: mapChannelCatalogToCurrentRows('ajd', await crawlAjdWaterPurifierCatalog()),
          }),
        },
        {
          channel: 'miso',
          execute: async () => ({
            catalog: mapChannelCatalogToCurrentRows('miso', await crawlMisoWaterPurifierCatalog()),
          }),
        },
        {
          channel: 'rentre',
          execute: async () => ({
            catalog: mapChannelCatalogToCurrentRows(
              'rentre',
              await crawlRentreWaterPurifierCatalog(),
            ),
          }),
        },
      ],
    });
    const result = await runner.run({
      triggerType: resolveTriggerType(),
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'failed') {
      process.exitCode = 1;
    }
  } finally {
    await closePgPool();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Daily batch failed: ${message}`);
  process.exit(1);
});
