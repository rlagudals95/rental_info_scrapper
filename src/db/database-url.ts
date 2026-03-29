import { loadEnv } from './load-env';

export interface DatabaseConnectionConfig {
  connectionString: string;
  ssl?: { rejectUnauthorized: false };
}

function getRequiredEnv(
  name: 'DATABASE_URL' | 'DATABASE_URL_DIRECT',
  errorMessage: string,
): string {
  loadEnv();

  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(errorMessage);
  }

  return value;
}

function shouldUseSsl(connectionString: string): boolean {
  if (process.env.DB_SSL === 'false') {
    return false;
  }

  if (process.env.DB_SSL === 'true') {
    return true;
  }

  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');

  if (sslMode && sslMode !== 'disable') {
    return true;
  }

  return url.hostname.includes('.neon.tech');
}

export function getPooledDatabaseConnectionConfig(): DatabaseConnectionConfig {
  const connectionString = getRequiredEnv(
    'DATABASE_URL',
    'DATABASE_URL is missing. Set the Neon pooled connection string in DATABASE_URL.',
  );

  return {
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  };
}

export function getDirectDatabaseConnectionConfig(): DatabaseConnectionConfig {
  const connectionString = getRequiredEnv(
    'DATABASE_URL_DIRECT',
    'DATABASE_URL_DIRECT is missing. Set the Neon direct connection string for admin commands.',
  );

  return {
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  };
}
