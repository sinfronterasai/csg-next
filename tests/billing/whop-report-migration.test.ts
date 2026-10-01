import { readFileSync } from 'fs';
import { join } from 'path';

describe('Whop report purchase migration contract', () => {
  const sql = readFileSync(join(__dirname, '../../src/lib/profile/migration.sql'), 'utf8');

  test('adds provider-neutral provenance without deleting legacy Stripe fields', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS provider');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS provider_payment_id');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS provider_plan_id');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS purchaser_email');
    expect(sql).toContain('ux_report_orders_provider_payment');
    expect(sql).toContain("provider IN ('stripe','whop')");
    expect(sql).toContain("status IN ('pending','paid','consumed','failed','refunded')");
  });

  test('supports pending identity binding without weakening paid-state checks', () => {
    expect(sql).toContain('ALTER TABLE report_orders ALTER COLUMN user_id DROP NOT NULL');
    expect(sql).toContain('idx_report_orders_purchaser_email');
  });
});
