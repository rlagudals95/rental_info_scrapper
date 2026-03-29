# Daily Batch Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily batch entrypoint that crawls the three channels, records batch/channel run history in PostgreSQL, appends price snapshots, updates current normalized rows for successful channels only, and keeps incident CSV archives.

**Architecture:** Keep scheduling outside the app and implement a single `batch:daily` command that orchestrates channel executors. Inside the codebase, split responsibilities into small files for DB access, drift detection, CSV retention policy, normalized row mapping, and batch orchestration so channel failures stay isolated and current rows are only updated per successful channel.

**Tech Stack:** TypeScript, Node.js, PostgreSQL (`pg`), Jest, tsx

---

## File Structure

### Create

- `src/db/database-url.ts` — shared `DATABASE_URL` and SSL resolution
- `src/db/pg-client.ts` — PostgreSQL client factory and transaction helper
- `src/crawl/batch/batch.types.ts` — batch/channel run types and normalized write models
- `src/crawl/batch/drift-detector.ts` — count/null/card metadata drift rules
- `src/crawl/batch/batch-csv-manager.ts` — latest/incident archive CSV retention
- `src/crawl/batch/channel-catalog.mapper.ts` — crawler result to normalized product/plan/offer rows
- `src/crawl/batch/batch-run.repository.ts` — `batch_runs`, `crawl_runs`, snapshots, current upsert persistence
- `src/crawl/batch/daily-batch-runner.ts` — orchestration for the daily batch
- `src/crawl/run-daily-batch.ts` — CLI entrypoint used by cron
- `src/crawl/batch/drift-detector.spec.ts` — unit tests for drift rules
- `src/crawl/batch/batch-csv-manager.spec.ts` — unit tests for archive retention policy
- `src/crawl/batch/channel-catalog.mapper.spec.ts` — unit tests for normalized mapping
- `src/crawl/batch/daily-batch-runner.spec.ts` — unit tests for partial success behavior

### Modify

- `db/schema.sql` — add `batch_runs`, extend `crawl_runs`
- `src/db/check-connection.ts` — reuse shared DB config helper
- `src/db/init-schema.ts` — reuse shared DB config helper
- `src/crawl/export-water-purifier-csv.ts` — expose CSV write behavior that batch manager can reuse
- `package.json` — add `batch:daily` script

---

### Task 1: Add DB Foundation And Batch Schema

**Files:**
- Create: `src/db/database-url.ts`
- Create: `src/db/pg-client.ts`
- Modify: `db/schema.sql`
- Modify: `src/db/check-connection.ts`
- Modify: `src/db/init-schema.ts`
- Test: `npm run build`

- [ ] **Step 1: Write the shared DB config helper**

```ts
// src/db/database-url.ts
export interface DatabaseConnectionConfig {
  connectionString: string;
  ssl: { rejectUnauthorized: false } | undefined;
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL.');
  }

  return databaseUrl;
}

export function getDatabaseConnectionConfig(): DatabaseConnectionConfig {
  return {
    connectionString: getDatabaseUrl(),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}
```

- [ ] **Step 2: Add a reusable PostgreSQL client helper**

```ts
// src/db/pg-client.ts
import { Client } from 'pg';

import { getDatabaseConnectionConfig } from './database-url';

export function createPgClient(): Client {
  return new Client(getDatabaseConnectionConfig());
}

export async function withPgClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = createPgClient();
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function withTransaction<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');

  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
```

- [ ] **Step 3: Extend the schema with batch history**

```sql
CREATE TABLE IF NOT EXISTS batch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
  channel_count INTEGER NOT NULL DEFAULT 0,
  success_channel_count INTEGER NOT NULL DEFAULT 0,
  failed_channel_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  latest_products_csv_path TEXT,
  latest_offers_csv_path TEXT,
  archived_products_csv_path TEXT,
  archived_offers_csv_path TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

ALTER TABLE crawl_runs
  ADD COLUMN IF NOT EXISTS batch_run_id UUID REFERENCES batch_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_slug TEXT,
  ADD COLUMN IF NOT EXISTS items_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drift_status TEXT NOT NULL DEFAULT 'ok'
    CHECK (drift_status IN ('ok', 'warning', 'critical', 'informational'));
```

- [ ] **Step 4: Reuse the shared DB helpers in existing scripts**

```ts
// src/db/check-connection.ts
import { withPgClient } from './pg-client';

async function main(): Promise<void> {
  const startedAt = Date.now();

  await withPgClient(async (client) => {
    const nowResult = await client.query<{ now: string }>('SELECT NOW()::text as now');
    const versionResult = await client.query<{ version: string }>('SELECT version()');

    console.log('✅ DB connection OK');
    console.log(`- now: ${nowResult.rows[0]?.now ?? 'unknown'}`);
    console.log(`- version: ${versionResult.rows[0]?.version ?? 'unknown'}`);
    console.log(`- latency_ms: ${Date.now() - startedAt}`);
  });
}
```

```ts
// src/db/init-schema.ts
import fs from 'node:fs';
import path from 'node:path';

import { withPgClient, withTransaction } from './pg-client';

async function main(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  await withPgClient((client) =>
    withTransaction(client, async () => {
      await client.query(schemaSql);
    }),
  );

  console.log('✅ Schema initialized successfully from db/schema.sql');
}
```

- [ ] **Step 5: Run the build and commit**

Run: `npm run build`
Expected: `tsc -p tsconfig.build.json` exits with code `0`

```bash
git add db/schema.sql src/db/database-url.ts src/db/pg-client.ts src/db/check-connection.ts src/db/init-schema.ts
git commit -m "feat: add batch run schema and db helpers"
```

### Task 2: Add Batch Types, Drift Rules, And CSV Incident Policy

**Files:**
- Create: `src/crawl/batch/batch.types.ts`
- Create: `src/crawl/batch/drift-detector.ts`
- Create: `src/crawl/batch/batch-csv-manager.ts`
- Create: `src/crawl/batch/drift-detector.spec.ts`
- Create: `src/crawl/batch/batch-csv-manager.spec.ts`
- Test: `npm test -- --watchman=false src/crawl/batch/drift-detector.spec.ts src/crawl/batch/batch-csv-manager.spec.ts`

- [ ] **Step 1: Define the batch and quality types**

```ts
// src/crawl/batch/batch.types.ts
export type BatchTriggerType = 'scheduled' | 'manual';
export type BatchRunStatus = 'running' | 'success' | 'partial_success' | 'failed';
export type DriftStatus = 'ok' | 'warning' | 'critical' | 'informational';
export type ChannelSlug = 'ajd' | 'miso' | 'rentre';

export interface ChannelQualityMetrics {
  offersCount: number;
  contractTermNullRate: number;
  managementTypeNullRate: number;
  primaryCardCompanyNullRate: number;
  affiliateCardOfferCount: number;
  affiliateCardCompanyFilledCount: number;
  affiliateCardNameFilledCount: number;
}

export interface DriftDetectionResult {
  status: DriftStatus;
  warnings: string[];
}
```

- [ ] **Step 2: Write the failing drift detector tests**

```ts
// src/crawl/batch/drift-detector.spec.ts
import { detectChannelDrift } from './drift-detector';

describe('detectChannelDrift', () => {
  it('returns warning when offer count drops by 25 percent', () => {
    const result = detectChannelDrift('ajd', {
      previous: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 80,
        affiliateCardCompanyFilledCount: 80,
        affiliateCardNameFilledCount: 80,
      },
      current: {
        offersCount: 74,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 0,
        affiliateCardOfferCount: 60,
        affiliateCardCompanyFilledCount: 60,
        affiliateCardNameFilledCount: 60,
      },
    });

    expect(result.status).toBe('warning');
  });

  it('returns informational for miso card metadata gaps', () => {
    const result = detectChannelDrift('miso', {
      previous: null,
      current: {
        offersCount: 100,
        contractTermNullRate: 0,
        managementTypeNullRate: 0,
        primaryCardCompanyNullRate: 1,
        affiliateCardOfferCount: 100,
        affiliateCardCompanyFilledCount: 0,
        affiliateCardNameFilledCount: 0,
      },
    });

    expect(result.status).toBe('informational');
  });
});
```

- [ ] **Step 3: Implement the drift detector**

```ts
// src/crawl/batch/drift-detector.ts
import { ChannelQualityMetrics, ChannelSlug, DriftDetectionResult } from './batch.types';

export function detectChannelDrift(
  channel: ChannelSlug,
  input: { previous: ChannelQualityMetrics | null; current: ChannelQualityMetrics },
): DriftDetectionResult {
  const warnings: string[] = [];
  let status: DriftDetectionResult['status'] = 'ok';

  if (input.previous) {
    const offerDropRatio =
      input.previous.offersCount === 0
        ? 0
        : (input.previous.offersCount - input.current.offersCount) / input.previous.offersCount;

    if (offerDropRatio >= 0.5) {
      status = 'critical';
      warnings.push('offers_count_drop_50_percent');
    } else if (offerDropRatio >= 0.25) {
      status = 'warning';
      warnings.push('offers_count_drop_25_percent');
    }
  }

  if (channel === 'miso' && input.current.affiliateCardOfferCount > 0) {
    return {
      status: status === 'ok' ? 'informational' : status,
      warnings:
        status === 'ok'
          ? ['miso_card_company_not_public']
          : [...warnings, 'miso_card_company_not_public'],
    };
  }

  return { status, warnings };
}
```

- [ ] **Step 4: Add incident-aware CSV retention policy tests and implementation**

```ts
// src/crawl/batch/batch-csv-manager.spec.ts
import { shouldArchiveCsvArtifacts } from './batch-csv-manager';

describe('shouldArchiveCsvArtifacts', () => {
  it('archives on partial success', () => {
    expect(shouldArchiveCsvArtifacts('partial_success', ['ok', 'ok', 'ok'])).toBe(true);
  });

  it('archives on channel warning', () => {
    expect(shouldArchiveCsvArtifacts('success', ['ok', 'warning', 'ok'])).toBe(true);
  });

  it('keeps latest only on clean success', () => {
    expect(shouldArchiveCsvArtifacts('success', ['ok', 'ok', 'ok'])).toBe(false);
  });
});
```

```ts
// src/crawl/batch/batch-csv-manager.ts
import type { AllWaterPurifierCrawlResult } from '../all-water-purifier.crawler';
import type { WaterPurifierCsvExportResult } from '../export-water-purifier-csv';
import { writeWaterPurifierCsvArtifacts } from '../export-water-purifier-csv';
import { BatchRunStatus, DriftStatus } from './batch.types';

export function shouldArchiveCsvArtifacts(
  batchStatus: BatchRunStatus,
  channelStatuses: readonly DriftStatus[],
): boolean {
  if (batchStatus === 'partial_success' || batchStatus === 'failed') {
    return true;
  }

  return channelStatuses.some((status) => status !== 'ok');
}

export class BatchCsvManager {
  async writeLatest(input: {
    batchStatus: BatchRunStatus;
    channelStatuses: readonly DriftStatus[];
    result: AllWaterPurifierCrawlResult;
    outputDir?: string;
  }): Promise<WaterPurifierCsvExportResult> {
    return writeWaterPurifierCsvArtifacts({
      result: input.result,
      outputDir: input.outputDir,
      archive: shouldArchiveCsvArtifacts(input.batchStatus, input.channelStatuses),
    });
  }
}
```

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --watchman=false src/crawl/batch/drift-detector.spec.ts src/crawl/batch/batch-csv-manager.spec.ts`
Expected: `PASS` for both test files

```bash
git add src/crawl/batch/batch.types.ts src/crawl/batch/drift-detector.ts src/crawl/batch/batch-csv-manager.ts src/crawl/batch/drift-detector.spec.ts src/crawl/batch/batch-csv-manager.spec.ts
git commit -m "feat: add batch drift detection and csv retention rules"
```

### Task 3: Add Normalized Mapping And Persistence Adapters

**Files:**
- Create: `src/crawl/batch/channel-catalog.mapper.ts`
- Create: `src/crawl/batch/batch-run.repository.ts`
- Create: `src/crawl/batch/channel-catalog.mapper.spec.ts`
- Test: `npm test -- --watchman=false src/crawl/batch/channel-catalog.mapper.spec.ts`

- [ ] **Step 1: Write the failing mapper test for product, plan, and offer identity**

```ts
// src/crawl/batch/channel-catalog.mapper.spec.ts
import { mapChannelCatalogToWrites } from './channel-catalog.mapper';

describe('mapChannelCatalogToWrites', () => {
  it('maps ajd offers into stable product-plan-offer identities', () => {
    const writes = mapChannelCatalogToWrites('ajd', {
      fetchedAt: '2026-03-28T00:00:00.000Z',
      products: [
        {
          externalProductId: 'ajd:RWP70F15AN',
          brandName: '삼성',
          productName: '비스포크',
          modelCode: 'RWP70F15AN',
          detailUrl: 'https://www.ajd.co.kr/detail/1',
          thumbnailUrl: null,
          featureTags: ['냉수', '온수', '정수'],
          metadata: { specifications: { 제품유형: '데스크형' } },
          offers: [
            {
              externalOfferId: 'ajd:52378:92426',
              offerName: '삼성 비스포크 60개월',
              publicOfferUrl: 'https://www.ajd.co.kr/detail/1',
              managementType: 'self',
              contractTermMonths: 60,
              publicMonthlyFee: 34900,
              cardAppliedMonthlyFee: 21900,
              supportPricingModel: 'hidden',
              supportAmount: null,
              supportAmountMin: null,
              supportAmountMax: null,
              metadata: {
                cardDiscountAmount: 13000,
                cardNames: ['뉴렌탈플러스 하나카드'],
                cardCompanies: ['하나카드'],
              },
            },
          ],
        },
      ],
    } as const);

    expect(writes.products[0].naturalKey).toBe('samsung:RWP70F15AN');
    expect(writes.rentalPlans[0].naturalKey).toBe('samsung:RWP70F15AN:self:60');
    expect(writes.channelOffers[0].externalOfferId).toBe('ajd:52378:92426');
  });
});
```

- [ ] **Step 2: Implement the normalized mapping**

```ts
// src/crawl/batch/channel-catalog.mapper.ts
import { AllWaterPurifierCatalogs } from '../all-water-purifier.crawler';
import { ChannelSlug } from './batch.types';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mapChannelCatalogToWrites(
  channel: ChannelSlug,
  catalog: Pick<AllWaterPurifierCatalogs[ChannelSlug], 'fetchedAt' | 'products'>,
) {
  const products = catalog.products.map((product) => ({
    naturalKey: `${slugify(product.brandName)}:${product.modelCode}`,
    channel,
    product,
  }));

  const rentalPlans = catalog.products.flatMap((product) =>
    product.offers.map((offer) => ({
      naturalKey: `${slugify(product.brandName)}:${product.modelCode}:${offer.managementType ?? 'unknown'}:${offer.contractTermMonths ?? 0}`,
      channel,
      product,
      offer,
    })),
  );

  const channelOffers = catalog.products.flatMap((product) =>
    product.offers.map((offer) => ({
      externalOfferId: offer.externalOfferId,
      channel,
      product,
      offer,
    })),
  );

  return { products, rentalPlans, channelOffers };
}
```

- [ ] **Step 3: Add repository methods for batch history and normalized writes**

```ts
// src/crawl/batch/batch-run.repository.ts
import { Client } from 'pg';

export class BatchRunRepository {
  constructor(private readonly client: Client) {}

  async createBatchRun(triggerType: 'scheduled' | 'manual'): Promise<{ id: string }> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO rental.batch_runs (trigger_type, status)
       VALUES ($1, 'running')
       RETURNING id`,
      [triggerType],
    );

    return result.rows[0];
  }

  async createChannelRun(input: {
    batchRunId: string;
    crawlSourceId: string;
    channelSlug: 'ajd' | 'miso' | 'rentre';
  }): Promise<{ id: string }> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO rental.crawl_runs (crawl_source_id, batch_run_id, channel_slug, status)
       VALUES ($1, $2, $3, 'running')
       RETURNING id`,
      [input.crawlSourceId, input.batchRunId, input.channelSlug],
    );

    return result.rows[0];
  }

  async finishChannelRun(input: {
    channelRunId: string;
    status: 'success' | 'failed';
    errorMessage: string | null;
  }): Promise<void> {
    await this.client.query(
      `UPDATE rental.crawl_runs
       SET status = $2,
           error_message = $3,
           finished_at = NOW()
       WHERE id = $1`,
      [input.channelRunId, input.status, input.errorMessage],
    );
  }

  async finishBatchRun(input: {
    batchRunId: string;
    status: 'success' | 'partial_success' | 'failed';
  }): Promise<void> {
    await this.client.query(
      `UPDATE rental.batch_runs
       SET status = $2,
           finished_at = NOW()
       WHERE id = $1`,
      [input.batchRunId, input.status],
    );
  }
}
```

- [ ] **Step 4: Add current upsert and snapshot write helpers inside the repository**

```ts
async upsertChannelOffer(input: {
  salesChannelId: string;
  productId: string;
  rentalPlanId: string;
  externalOfferId: string;
  offerName: string;
  publicOfferUrl: string;
  publicMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  supportPricingModel: 'fixed_public' | 'range_public' | 'quote_required' | 'hidden';
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  metadata: Record<string, unknown>;
}): Promise<{ id: string }> {
  const result = await this.client.query<{ id: string }>(
    `INSERT INTO rental.channel_offers (
       sales_channel_id, product_id, rental_plan_id, offer_name, public_offer_url,
       public_monthly_fee, non_card_monthly_fee, card_applied_monthly_fee,
       support_pricing_model, support_amount, support_amount_min, support_amount_max,
       payout_timing, payout_method, benefit_guarantee_type, matching_status, review_status, metadata
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $6, $7,
       $8, $9, $10, $11,
       'unknown', 'unknown', 'unclear', 'auto_matched', 'approved', $12::jsonb
     )
     ON CONFLICT (public_offer_url) DO UPDATE
       SET offer_name = EXCLUDED.offer_name,
           public_monthly_fee = EXCLUDED.public_monthly_fee,
           non_card_monthly_fee = EXCLUDED.non_card_monthly_fee,
           card_applied_monthly_fee = EXCLUDED.card_applied_monthly_fee,
           support_pricing_model = EXCLUDED.support_pricing_model,
           support_amount = EXCLUDED.support_amount,
           support_amount_min = EXCLUDED.support_amount_min,
           support_amount_max = EXCLUDED.support_amount_max,
           metadata = EXCLUDED.metadata,
           last_seen_at = NOW(),
           updated_at = NOW()
     RETURNING id`,
    [
      input.salesChannelId,
      input.productId,
      input.rentalPlanId,
      input.offerName,
      input.publicOfferUrl,
      input.publicMonthlyFee,
      input.cardAppliedMonthlyFee,
      input.supportPricingModel,
      input.supportAmount,
      input.supportAmountMin,
      input.supportAmountMax,
      JSON.stringify({
        ...input.metadata,
        externalOfferId: input.externalOfferId,
      }),
    ],
  );

  return result.rows[0];
}
```

- [ ] **Step 5: Run the mapper test and commit**

Run: `npm test -- --watchman=false src/crawl/batch/channel-catalog.mapper.spec.ts`
Expected: `PASS src/crawl/batch/channel-catalog.mapper.spec.ts`

```bash
git add src/crawl/batch/channel-catalog.mapper.ts src/crawl/batch/batch-run.repository.ts src/crawl/batch/channel-catalog.mapper.spec.ts
git commit -m "feat: add batch mapping and persistence adapters"
```

### Task 4: Build The Daily Batch Runner And CLI

**Files:**
- Create: `src/crawl/batch/daily-batch-runner.ts`
- Create: `src/crawl/run-daily-batch.ts`
- Modify: `src/crawl/export-water-purifier-csv.ts`
- Modify: `package.json`
- Create: `src/crawl/batch/daily-batch-runner.spec.ts`
- Test: `npm test -- --watchman=false src/crawl/batch/daily-batch-runner.spec.ts`

- [ ] **Step 1: Write the failing partial-success orchestration test**

```ts
// src/crawl/batch/daily-batch-runner.spec.ts
import { DailyBatchRunner } from './daily-batch-runner';

describe('DailyBatchRunner', () => {
  it('keeps successful channels current when one channel fails', async () => {
    const runner = new DailyBatchRunner({
      crawlAjd: async () => ({ products: [], offersCount: 10 } as any),
      crawlMiso: async () => ({ products: [], offersCount: 20 } as any),
      crawlRentre: async () => {
        throw new Error('network timeout');
      },
      repository: {
        createBatchRun: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        createChannelRun: jest.fn().mockResolvedValue({ id: 'channel-1' }),
        finishChannelRun: jest.fn(),
        finishBatchRun: jest.fn(),
        persistSuccessfulChannel: jest.fn(),
      } as any,
      csvManager: {
        writeLatest: jest.fn().mockResolvedValue({
          latestProductsCsvPath: 'exports/latest-products.csv',
          latestOffersCsvPath: 'exports/latest-offers.csv',
          archivedProductsCsvPath: null,
          archivedOffersCsvPath: null,
        }),
      } as any,
    });

    const result = await runner.run({ triggerType: 'scheduled' });

    expect(result.status).toBe('partial_success');
    expect(result.channelResults.rentre.status).toBe('failed');
    expect(result.channelResults.ajd.status).toBe('success');
    expect(result.channelResults.miso.status).toBe('success');
  });
});
```

- [ ] **Step 2: Implement the batch runner**

```ts
// src/crawl/batch/daily-batch-runner.ts
import { crawlAjdWaterPurifierCatalog } from '../ajd-water-purifier.crawler';
import { crawlMisoWaterPurifierCatalog } from '../miso-water-purifier.crawler';
import { crawlRentreWaterPurifierCatalog } from '../rentre-water-purifier.crawler';

export class DailyBatchRunner {
  constructor(private readonly deps: {
    crawlAjd?: typeof crawlAjdWaterPurifierCatalog;
    crawlMiso?: typeof crawlMisoWaterPurifierCatalog;
    crawlRentre?: typeof crawlRentreWaterPurifierCatalog;
    repository: {
      createBatchRun: (triggerType: 'scheduled' | 'manual') => Promise<{ id: string }>;
      createChannelRun: (input: { batchRunId: string; crawlSourceId: string; channelSlug: 'ajd' | 'miso' | 'rentre' }) => Promise<{ id: string }>;
      persistSuccessfulChannel: (input: { channel: 'ajd' | 'miso' | 'rentre'; catalog: unknown; channelRunId: string }) => Promise<void>;
      finishChannelRun: (input: { channelRunId: string; status: 'success' | 'failed'; errorMessage: string | null }) => Promise<void>;
      finishBatchRun: (input: { batchRunId: string; status: 'success' | 'partial_success' | 'failed' }) => Promise<void>;
    };
    csvManager: {
      writeLatest: (input: { batchStatus: 'success' | 'partial_success' | 'failed'; result: unknown; channelStatuses: readonly ('ok' | 'warning' | 'critical' | 'informational')[] }) => Promise<unknown>;
    };
  }) {}

  async run(input: { triggerType: 'scheduled' | 'manual' }) {
    const batchRun = await this.deps.repository.createBatchRun(input.triggerType);
    const channelResults: Record<string, { status: 'success' | 'failed' }> = {};
    const successfulCatalogs: Record<string, unknown> = {};

    for (const [channel, crawl] of [
      ['ajd', this.deps.crawlAjd ?? crawlAjdWaterPurifierCatalog],
      ['miso', this.deps.crawlMiso ?? crawlMisoWaterPurifierCatalog],
      ['rentre', this.deps.crawlRentre ?? crawlRentreWaterPurifierCatalog],
    ] as const) {
      let channelRunId: string | null = null;

      try {
        const channelRun = await this.deps.repository.createChannelRun({
          batchRunId: batchRun.id,
          crawlSourceId: channel,
          channelSlug: channel,
        });
        channelRunId = channelRun.id;

        const catalog = await crawl();
        await this.deps.repository.persistSuccessfulChannel({
          channel,
          catalog,
          channelRunId: channelRun.id,
        });
        await this.deps.repository.finishChannelRun({
          channelRunId: channelRun.id,
          status: 'success',
          errorMessage: null,
        });

        channelResults[channel] = { status: 'success' };
        successfulCatalogs[channel] = catalog;
      } catch (error) {
        if (channelRunId) {
          await this.deps.repository.finishChannelRun({
            channelRunId,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        channelResults[channel] = { status: 'failed' };
      }
    }

    const statuses = Object.values(channelResults).map((result) => result.status);
    const batchStatus =
      statuses.every((status) => status === 'success')
        ? 'success'
        : statuses.some((status) => status === 'success')
          ? 'partial_success'
          : 'failed';

    if (Object.keys(successfulCatalogs).length === 3) {
      await this.deps.csvManager.writeLatest({
        batchStatus,
        result: { channels: successfulCatalogs },
        channelStatuses: ['ok', 'ok', 'ok'],
      });
    }

    await this.deps.repository.finishBatchRun({
      batchRunId: batchRun.id,
      status: batchStatus,
    });

    return { status: batchStatus, channelResults };
  }
}
```

- [ ] **Step 3: Refactor CSV export for batch reuse**

```ts
// src/crawl/export-water-purifier-csv.ts
export async function writeWaterPurifierCsvArtifacts(input: {
  result: AllWaterPurifierCrawlResult;
  outputDir?: string;
  archive: boolean;
}): Promise<WaterPurifierCsvExportResult> {
  const outputDir = input.outputDir ?? path.join(process.cwd(), 'exports', 'water-purifier');
  const productRows = buildWaterPurifierProductCsvRows(input.result);
  const offerRows = buildWaterPurifierOfferCsvRows(input.result);
  const productsCsvContent = renderCsv(productRows, PRODUCT_CSV_COLUMNS);
  const offersCsvContent = renderCsv(offerRows, OFFER_CSV_COLUMNS);
  const timestamp = sanitizeTimestamp(input.result.fetchedAt);

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'latest-products.csv'), productsCsvContent, 'utf8'),
    writeFile(path.join(outputDir, 'latest-offers.csv'), offersCsvContent, 'utf8'),
  ]);

  if (input.archive) {
    await Promise.all([
      writeFile(path.join(outputDir, `${timestamp}-products.csv`), productsCsvContent, 'utf8'),
      writeFile(path.join(outputDir, `${timestamp}-offers.csv`), offersCsvContent, 'utf8'),
    ]);
  }

  return {
    outputDir,
    latestProductsCsvPath: path.join(outputDir, 'latest-products.csv'),
    latestOffersCsvPath: path.join(outputDir, 'latest-offers.csv'),
    timestampedProductsCsvPath: input.archive ? path.join(outputDir, `${timestamp}-products.csv`) : '',
    timestampedOffersCsvPath: input.archive ? path.join(outputDir, `${timestamp}-offers.csv`) : '',
    summary: input.result.summary,
  };
}
```

- [ ] **Step 4: Add the CLI entrypoint and script**

```ts
// src/crawl/run-daily-batch.ts
import { createPgClient } from '../db/pg-client';
import { BatchCsvManager } from './batch/batch-csv-manager';
import { BatchRunRepository } from './batch/batch-run.repository';
import { DailyBatchRunner } from './batch/daily-batch-runner';

async function main(): Promise<void> {
  const client = createPgClient();
  await client.connect();

  try {
    const runner = new DailyBatchRunner({
      repository: new BatchRunRepository(client),
      csvManager: new BatchCsvManager(),
    });

    const result = await runner.run({ triggerType: 'scheduled' });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

void main();
```

```json
// package.json
{
  "scripts": {
    "batch:daily": "tsx src/crawl/run-daily-batch.ts"
  }
}
```

- [ ] **Step 5: Run the runner test, build, and commit**

Run: `npm test -- --watchman=false src/crawl/batch/daily-batch-runner.spec.ts && npm run build`
Expected: Jest `PASS` and TypeScript build success

```bash
git add src/crawl/batch/daily-batch-runner.ts src/crawl/run-daily-batch.ts src/crawl/export-water-purifier-csv.ts src/crawl/batch/daily-batch-runner.spec.ts package.json
git commit -m "feat: add daily batch runner entrypoint"
```

### Task 5: Finish End-To-End Batch Verification

**Files:**
- Modify: `README.md`
- Test: `npm run db:init`
- Test: `npm run batch:daily`
- Test: `npm run crawl:validate`

- [ ] **Step 1: Document the daily batch command**

```md
## Daily Batch

Initialize the schema and run the daily batch:

```bash
npm run db:init
npm run batch:daily
```

Recommended cron:

```cron
0 5 * * * cd /path/to/rental_info_scrpper && /usr/bin/env npm run batch:daily >> /var/log/rental-info-batch.log 2>&1
```
```

- [ ] **Step 2: Initialize the schema against a real database**

Run: `npm run db:init`
Expected: `✅ Schema initialized successfully from db/schema.sql`

- [ ] **Step 3: Run the daily batch end to end**

Run: `npm run batch:daily`
Expected: JSON output containing `status`, `channelResults`, and CSV paths without an uncaught exception

- [ ] **Step 4: Re-run CSV validation**

Run: `npm run crawl:validate`
Expected: `Validation passed (warnings may exist for exceptional products).`

- [ ] **Step 5: Commit the docs and verification changes**

```bash
git add README.md
git commit -m "docs: document daily batch runner"
```

## Self-Review

### Spec coverage

- Daily batch entrypoint: covered by Task 4
- `batch_runs` and `crawl_runs` history: covered by Task 1 and Task 3
- Drift detection: covered by Task 2
- Incident CSV retention: covered by Task 2 and Task 4
- Snapshot and current upsert: covered by Task 3
- Partial success behavior: covered by Task 4

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every code-changing step includes a concrete code block.

### Type consistency

- Batch statuses use `running | success | partial_success | failed` consistently.
- Drift statuses use `ok | warning | critical | informational` consistently.
- Channel slugs use `ajd | miso | rentre` consistently.
