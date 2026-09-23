import { buildDbPoolConfig } from '@/lib/db';

describe('Render database TLS configuration', () => {
  test('sslmode=require cannot override the explicit encrypted private-network policy', () => {
    const config = buildDbPoolConfig('postgresql://user:pass@example.internal:5432/app?sslmode=require');
    expect(config.connectionString).not.toContain('sslmode=');
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  test('verified SSL modes are preserved', () => {
    const url = 'postgresql://user:pass@example.com:5432/app?sslmode=verify-full';
    const config = buildDbPoolConfig(url);
    expect(config.connectionString).toBe(url);
    expect(config.ssl).toBeUndefined();
  });

  test('non-SSL connection strings are unchanged', () => {
    const url = 'postgresql://user:pass@example.internal:5432/app';
    const config = buildDbPoolConfig(url);
    expect(config.connectionString).toBe(url);
    expect(config.ssl).toBeUndefined();
  });
});
