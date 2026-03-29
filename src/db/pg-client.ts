import type { Client, PoolClient } from 'pg';
import { Client as PgClient, Pool } from 'pg';

import {
  getDirectDatabaseConnectionConfig,
  getPooledDatabaseConnectionConfig,
} from './database-url';

let pgPool: Pool | undefined;

type TransactionClient = {
  query: Client['query'];
};

export function getPgPool(): Pool {
  pgPool ??= new Pool(getPooledDatabaseConnectionConfig());
  return pgPool;
}

export async function closePgPool(): Promise<void> {
  if (!pgPool) {
    return;
  }

  const pool = pgPool;
  pgPool = undefined;
  await pool.end();
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function createDirectPgClient(): Client {
  return new PgClient(getDirectDatabaseConnectionConfig());
}

export async function withDirectPgClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = createDirectPgClient();
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function withTransaction<T>(client: TransactionClient, fn: () => Promise<T>): Promise<T> {
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
