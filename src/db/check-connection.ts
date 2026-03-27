import { Client } from 'pg';

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL.');
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  const useSsl = process.env.DB_SSL === 'true';

  const client = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  const startedAt = Date.now();

  try {
    await client.connect();
    const nowResult = await client.query<{ now: string }>('SELECT NOW()::text as now');
    const versionResult = await client.query<{ version: string }>('SELECT version()');

    console.log('✅ DB connection OK');
    console.log(`- now: ${nowResult.rows[0]?.now ?? 'unknown'}`);
    console.log(`- version: ${versionResult.rows[0]?.version ?? 'unknown'}`);
    console.log(`- latency_ms: ${Date.now() - startedAt}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ DB connection failed: ${message}`);
  process.exit(1);
});
