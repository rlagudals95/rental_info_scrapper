import { closePgPool, withPgClient } from './pg-client';

async function main(): Promise<void> {
  const startedAt = Date.now();

  try {
    await withPgClient(async (client) => {
      const nowResult = await client.query<{ now: string }>('SELECT NOW()::text as now');
      const versionResult = await client.query<{ version: string }>('SELECT version()');

      console.log('✅ DB pooled connection OK');
      console.log(`- now: ${nowResult.rows[0]?.now ?? 'unknown'}`);
      console.log(`- version: ${versionResult.rows[0]?.version ?? 'unknown'}`);
      console.log(`- latency_ms: ${Date.now() - startedAt}`);
    });
  } finally {
    await closePgPool();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ DB connection failed: ${message}`);
  process.exit(1);
});
