import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL.');
  }

  return databaseUrl;
}

function getSchemaSql(): string {
  const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at ${schemaPath}`);
  }

  return fs.readFileSync(schemaPath, 'utf-8');
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  const schemaSql = getSchemaSql();
  const useSsl = process.env.DB_SSL === 'true';

  const client = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');

    console.log('✅ Schema initialized successfully from db/schema.sql');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Schema init failed: ${message}`);
  process.exit(1);
});
