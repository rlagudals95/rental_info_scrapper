import fs from 'node:fs';
import path from 'node:path';

import { withDirectPgClient, withTransaction } from './pg-client';

function getSchemaSql(): string {
  const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at ${schemaPath}`);
  }

  return fs.readFileSync(schemaPath, 'utf-8');
}

async function main(): Promise<void> {
  const schemaSql = getSchemaSql();

  await withDirectPgClient((client) =>
    withTransaction(client, async () => {
      await client.query(schemaSql);
    }),
  );

  console.log('✅ Schema initialized successfully from db/schema.sql using direct DB connection');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Schema init failed: ${message}`);
  process.exit(1);
});
