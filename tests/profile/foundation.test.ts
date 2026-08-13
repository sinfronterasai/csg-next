import { readFileSync } from 'fs';
import { join } from 'path';

describe('Cosmic Profile Hub foundation', () => {
  it('migration.sql is idempotent (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)', () => {
    const sql = readFileSync(join(__dirname, '../../src/lib/profile/migration.sql'), 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS');
    expect(sql).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
  });

  it('profile store exposes the unified reading API', () => {
    const src = readFileSync(join(__dirname, '../../src/lib/profile/store.ts'), 'utf8');
    expect(src).toContain('saveUniversalReading');
    expect(src).toContain('listReadingsByType');
    expect(src).toContain('getProfileStats');
  });

  it('patterns module frames insights as reflection, not prediction', () => {
    const src = readFileSync(join(__dirname, '../../src/lib/profile/patterns.ts'), 'utf8');
    expect(src).toMatch(/you may notice/);
    expect(src).not.toMatch(/will (definitely|certainly|always) (happen|occur)/i);
  });
});
