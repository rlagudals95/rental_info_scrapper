describe('database connection config', () => {
  const originalEnv = process.env;

  function withDatabaseUrlModule<T>(
    callback: (databaseUrlModule: typeof import('./database-url')) => T,
  ): T {
    let result!: T;

    jest.isolateModules(() => {
      jest.doMock('./load-env', () => ({
        loadEnv: jest.fn(),
      }));

      const databaseUrlModule = require('./database-url') as typeof import('./database-url');
      result = callback(databaseUrlModule);
    });

    return result;
  }

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
    expect(() =>
      withDatabaseUrlModule(({ getPooledDatabaseConnectionConfig }) =>
        getPooledDatabaseConnectionConfig(),
      ),
    ).toThrow('DATABASE_URL is missing. Set the Neon pooled connection string in DATABASE_URL.');
  });

  it('uses DATABASE_URL as the pooled connection string', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require';

    const config = withDatabaseUrlModule(({ getPooledDatabaseConnectionConfig }) =>
      getPooledDatabaseConnectionConfig(),
    );

    expect(config).toMatchObject({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  });

  it('throws when a direct connection is required but DATABASE_URL_DIRECT is missing', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require';

    expect(() =>
      withDatabaseUrlModule(({ getDirectDatabaseConnectionConfig }) =>
        getDirectDatabaseConnectionConfig(),
      ),
    ).toThrow(
      'DATABASE_URL_DIRECT is missing. Set the Neon direct connection string for admin commands.',
    );
  });

  it('disables ssl when DB_SSL is explicitly false', () => {
    process.env.DATABASE_URL =
      'postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/db';
    process.env.DB_SSL = 'false';

    const config = withDatabaseUrlModule(({ getPooledDatabaseConnectionConfig }) =>
      getPooledDatabaseConnectionConfig(),
    );

    expect(config.ssl).toBeUndefined();
  });
});
