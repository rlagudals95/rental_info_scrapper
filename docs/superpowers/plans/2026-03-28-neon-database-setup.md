# Neon Database Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure this project to use Neon as the default PostgreSQL provider with pooled runtime connections, direct admin connections, automatic `.env` loading, and deployment guidance for public MVP operation.

**Architecture:** Keep the existing `pg`-based persistence layer, but split connection resolution into explicit pooled and direct paths. Add an idempotent env loader that works for both API and CLI entrypoints, migrate runtime DB access to a shared `Pool`, keep schema/admin commands on direct `Client`, and document the Neon operating model for local-first development and later always-on production.

**Tech Stack:** NestJS, TypeScript, `pg`, Node.js 22 built-in `process.loadEnvFile`, Jest

---

## File Structure

- Create: `src/db/load-env.ts` — idempotent `.env` loader using Node 22 built-in support
- Modify: `src/db/database-url.ts` — pooled/direct URL resolution and TLS rules
- Modify: `src/db/pg-client.ts` — pooled `Pool` singleton, direct client helper, shared transaction helper
- Modify: `src/db/check-connection.ts` — pooled connection check
- Modify: `src/db/init-schema.ts` — direct connection check
- Modify: `src/main.ts` — boot-time env loading
- Create: `src/db/database-url.spec.ts` — regression tests for env/config behavior
- Modify: `.env.example` — Neon pooled/direct examples
- Modify: `README.md` — setup and operating guidance
- Create: `docs/neon-deployment-guide.md` — public MVP deployment playbook

### Task 1: Lock Config Rules With Tests

**Files:**
- Create: `src/db/database-url.spec.ts`
- Modify: `src/db/database-url.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('database connection config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_DIRECT;
    delete process.env.DB_SSL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when DATABASE_URL is missing', () => {
    jest.isolateModules(() => {
      jest.doMock('./load-env', () => ({
        loadEnv: jest.fn(),
      }));

      const { getPooledDatabaseConnectionConfig } = require('./database-url');

      expect(() => getPooledDatabaseConnectionConfig()).toThrow(
        'DATABASE_URL is missing. Set the Neon pooled connection string in DATABASE_URL.',
      );
    });
  });

  it('uses DATABASE_URL as the pooled connection string', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require';

    jest.isolateModules(() => {
      jest.doMock('./load-env', () => ({
        loadEnv: jest.fn(),
      }));

      const { getPooledDatabaseConnectionConfig } = require('./database-url');

      expect(getPooledDatabaseConnectionConfig()).toMatchObject({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db/database-url.spec.ts`
Expected: FAIL because `database-url.ts` does not yet export pooled/direct helpers or the new Neon-focused error messages.

- [ ] **Step 3: Expand the failing test with direct and SSL cases**

```ts
it('throws when a direct connection is required but DATABASE_URL_DIRECT is missing', () => {
  process.env.DATABASE_URL =
    'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require';

  jest.isolateModules(() => {
    jest.doMock('./load-env', () => ({
      loadEnv: jest.fn(),
    }));

    const { getDirectDatabaseConnectionConfig } = require('./database-url');

    expect(() => getDirectDatabaseConnectionConfig()).toThrow(
      'DATABASE_URL_DIRECT is missing. Set the Neon direct connection string for admin commands.',
    );
  });
});

it('disables ssl when DB_SSL is explicitly false', () => {
  process.env.DATABASE_URL =
    'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db';
  process.env.DB_SSL = 'false';

  jest.isolateModules(() => {
    jest.doMock('./load-env', () => ({
      loadEnv: jest.fn(),
    }));

    const { getPooledDatabaseConnectionConfig } = require('./database-url');

    expect(getPooledDatabaseConnectionConfig().ssl).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails for the right reasons**

Run: `npm test -- src/db/database-url.spec.ts`
Expected: FAIL with assertion mismatches about missing exports or incorrect config values, not TypeScript syntax errors.

- [ ] **Step 5: Commit the red phase checkpoint**

```bash
git add src/db/database-url.spec.ts
git commit -m "test: add Neon database config coverage"
```

### Task 2: Implement Env Loading and Neon Connection Helpers

**Files:**
- Create: `src/db/load-env.ts`
- Modify: `src/db/database-url.ts`
- Modify: `src/db/pg-client.ts`
- Modify: `src/main.ts`
- Modify: `src/db/check-connection.ts`
- Modify: `src/db/init-schema.ts`
- Test: `src/db/database-url.spec.ts`

- [ ] **Step 1: Add the env loader**

```ts
// src/db/load-env.ts
import fs from 'node:fs';
import path from 'node:path';

let hasLoadedEnv = false;

export function loadEnv(): void {
  if (hasLoadedEnv) {
    return;
  }

  hasLoadedEnv = true;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  process.loadEnvFile(envPath);
}
```

- [ ] **Step 2: Replace single-URL parsing with pooled/direct helpers**

```ts
// src/db/database-url.ts
import { loadEnv } from './load-env';

export interface DatabaseConnectionConfig {
  connectionString: string;
  ssl?: { rejectUnauthorized: false };
}

function getRequiredEnv(name: 'DATABASE_URL' | 'DATABASE_URL_DIRECT', message: string): string {
  loadEnv();

  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(message);
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
```

- [ ] **Step 3: Move runtime access to a pooled singleton and keep direct admin access separate**

```ts
// src/db/pg-client.ts
import type { Client, PoolClient } from 'pg';
import { Client as PgClient, Pool } from 'pg';

import {
  getDirectDatabaseConnectionConfig,
  getPooledDatabaseConnectionConfig,
} from './database-url';

let pgPool: Pool | undefined;

export function getPgPool(): Pool {
  pgPool ??= new Pool(getPooledDatabaseConnectionConfig());
  return pgPool;
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

export async function closePgPool(): Promise<void> {
  if (!pgPool) {
    return;
  }

  const pool = pgPool;
  pgPool = undefined;
  await pool.end();
}
```

- [ ] **Step 4: Update entrypoints to load env and use the correct client path**

```ts
// src/main.ts
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadEnv } from './db/load-env';

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // ...
}
```

```ts
// src/db/init-schema.ts
import { withDirectPgClient, withTransaction } from './pg-client';

async function main(): Promise<void> {
  const schemaSql = getSchemaSql();

  await withDirectPgClient((client) =>
    withTransaction(client, async () => {
      await client.query(schemaSql);
    }),
  );
}
```

- [ ] **Step 5: Run the focused test to verify green**

Run: `npm test -- src/db/database-url.spec.ts`
Expected: PASS with all Neon config tests green.

- [ ] **Step 6: Run the broader regression suite for DB-related code**

Run: `npm test`
Expected: PASS with no regressions in existing crawler/comparison tests.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/db/load-env.ts src/db/database-url.ts src/db/pg-client.ts src/db/check-connection.ts src/db/init-schema.ts src/main.ts src/db/database-url.spec.ts
git commit -m "feat: configure Neon database connections"
```

### Task 3: Document Neon Setup and Operating Model

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/neon-deployment-guide.md`

- [ ] **Step 1: Update the env example for pooled/direct Neon URLs**

```env
# Neon pooled connection string for app runtime and batch jobs
DATABASE_URL=postgresql://USER:PASSWORD@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Neon direct connection string for schema init and admin commands
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Optional override. Leave unset for Neon.
DB_SSL=
```

- [ ] **Step 2: Rewrite the README setup section around Neon**

```md
## DB 설정 (Neon)

권장 기본값:

- Provider: `AWS`
- Region: `Asia Pacific (Singapore)`
- Plan: 개발은 `Free`, 외부 공개 운영은 `Launch`

필수 환경 변수:

```bash
cp .env.example .env
```

`DATABASE_URL`에는 pooled URL,
`DATABASE_URL_DIRECT`에는 direct URL을 넣습니다.

초기 스키마 반영:

```bash
npm run db:init
```

연결 점검:

```bash
npm run db:check
```
```

- [ ] **Step 3: Add a dedicated deployment guide**

```md
# Neon Deployment Guide

## 권장 운영 방식

- 개발: Neon Free + autosuspend 사용
- 공개 MVP: Neon Launch + 운영 DB autosuspend 해제
- 배치: 상시 서버에서 cron으로 `npm run batch:daily -- --scheduled`

## 플랜 전환 시점

- 외부 공개를 시작할 때
- 저장량이 0.5GB에 가까워질 때
- 운영 DB를 항상 켜둬야 할 때
```

- [ ] **Step 4: Run the build to verify docs/config changes didn’t break compilation**

Run: `npm run build`
Expected: PASS with exit code 0.

- [ ] **Step 5: Commit the documentation**

```bash
git add .env.example README.md docs/neon-deployment-guide.md
git commit -m "docs: add Neon setup guide"
```

### Task 4: Final Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the full verification commands**

Run:

```bash
npm test
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 2: Optionally verify the real DB connection when credentials are present**

Run:

```bash
npm run db:check
```

Expected: PASS and print the database server version plus latency if `.env` contains valid Neon credentials.

- [ ] **Step 3: Review the diff before handoff**

Run:

```bash
git diff --stat
git status --short
```

Expected: only the intended Neon configuration, tests, and documentation changes are included.
