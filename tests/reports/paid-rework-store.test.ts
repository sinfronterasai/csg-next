import { PGlite } from '@electric-sql/pglite';
import * as store from '@/lib/billing/reportPurchaseStore';
import { applyPipelineCallback } from '@/lib/profile/store';

import { Pool } from 'pg';
let db: PGlite;
let localPool: Pool | undefined;
let serial = Promise.resolve();
jest.mock('@/lib/db', () => ({
  query: (...args: any[]) => db.query(args[0], args[1]).then((r: any) => ({ ...r, rowCount: r.affectedRows })),
  transaction: (fn: any) => {
    if (localPool) return (async () => {
      const client = await localPool!.connect();
      try { return await fn((sql: string, values?: any[]) => client.query(sql, values)); }
      finally { client.release(); }
    })();
    // PGlite has one connection. Serialize transactions, as PostgreSQL row locks
    // do for this single reading. Real SQL executes; this is not a SQL string mock.
    const run = serial.then(() => fn(async (sql: string, values?: any[]) => {
      const r = await db.query(sql, values);
      return { rows: r.rows, rowCount: r.affectedRows };
    }));
    serial = run.catch(() => {});
    return run;
  },
}));
const oldId = '11111111-1111-4111-8111-111111111111';
const newId = '22222222-2222-4222-8222-222222222222';
const purchaseId = '33333333-3333-4333-8333-333333333333';
const original = { reportId: oldId, reportType: 'loveblueprint', metadata: { birthData: { name: 'Original' }, verifiedFacts: { fact: 1 } }, pipeline: { status: 'rejected', sections: ['old prose'] } };
const claim = () => (store as any).claimPaidRework({ readingId: 50, expectedReportId: oldId, reportId: newId, actorId: 9, reason: 'Repair rejected paid report' });
const reading = async () => (await db.query<any>('SELECT * FROM readings WHERE id = 50')).rows[0];

beforeAll(async () => {
  // Opt-in integration runs target ONLY a disposable localhost database; never
  // DATABASE_URL or inherited customer credentials. CREATE fails if tables exist.
  if (process.env.CSG_REWORK_LOCAL_PG === '1') {
    localPool = new Pool({ host: '127.0.0.1', port: 55439, database: 'rework_test', user: 'postgres', password: 'local-rework-test', ssl: false, max: 8 });
    db = { query: (sql: string, values?: any[]) => localPool!.query(sql, values), exec: (sql: string) => localPool!.query(sql), close: () => localPool!.end() } as unknown as PGlite;
  } else db = new PGlite();
  await db.exec(`CREATE TABLE readings (id int PRIMARY KEY, user_id int, type text, result jsonb, pipeline_status text, pipeline_callback_hash text, created_at timestamptz DEFAULT now());
    CREATE TABLE report_orders (id int PRIMARY KEY, purchase_id uuid, user_id int, report_type text, sku text, amount int, currency text, status text, reading_id int, report_id text, stripe_session_id text, stripe_payment_id text, updated_at timestamptz DEFAULT now());`);
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('DELETE FROM readings; DELETE FROM report_orders;');
  await db.query(`INSERT INTO readings VALUES (50,7,'report',$1,'rejected','old-hash',now() - interval '1 hour')`, [JSON.stringify(original)]);
  await db.query(`INSERT INTO report_orders (id,purchase_id,user_id,report_type,sku,amount,currency,status,reading_id,report_id,stripe_session_id,stripe_payment_id) VALUES (1,$1,7,'loveblueprint','report-loveblueprint',4900,'usd','consumed',50,$2,'cs_paid','pi_paid')`, [purchaseId, oldId]);
});

it('rejects a disabled or free SKU even when a consumed order was forged', async () => {
  await db.exec(`UPDATE report_orders SET report_type = 'transit', sku = 'report-transit'; UPDATE readings SET result = jsonb_set(result, '{reportType}', '"transit"')`);
  expect(await claim()).toMatchObject({ outcome: 'not_entitled' });
});

it.each(['approved', 'needs_editor', 'queued', 'processing'])('protects %s without terminal execution evidence', async (status) => {
  await db.query('UPDATE readings SET pipeline_status = $1', [status]);
  expect(await claim()).toMatchObject({ outcome: 'conflict' });
  expect((await reading()).result).toEqual(original);
});

it('allows an error state to rework only from the locked paid snapshot', async () => {
  await db.query("UPDATE readings SET pipeline_status = 'error'");
  expect(await claim()).toMatchObject({ outcome: 'claimed', reportId: newId, snapshot: original.metadata });
});

it.each(["status = 'paid'", 'user_id = 8', "sku = 'report-transit'", "report_type = 'transit'", 'amount = 0', 'stripe_payment_id = NULL'])('rejects invalid entitlement: %s', async (change) => {
  await db.exec(`UPDATE report_orders SET ${change}`);
  expect(await claim()).toMatchObject({ outcome: 'not_entitled' });
  expect((await reading()).result).toEqual(original);
});

it('permits only one concurrent claim and rejects stale callbacks while accepting the new callback', async () => {
  const outcomes = await Promise.all([claim(), claim()]);
  expect(outcomes.map((r) => r.outcome).sort()).toEqual(['claimed', 'conflict']);
  expect(await applyPipelineCallback({ reportId: oldId, status: 'approved', pipelineValue: { status: 'approved' }, callbackHash: 'late' })).toBe('not_found');
  const history = (await reading()).result.reworkHistory;
  expect(await applyPipelineCallback({ reportId: newId, status: 'approved', pipelineValue: { status: 'approved' }, callbackHash: 'new-hash' })).toBe('applied');
  expect((await reading()).result.reworkHistory).toEqual(history);
});

it('quarantines the known invalid UTC snapshot rather than replaying paid reading 1160', async () => {
  const invalidId = '6deeb156-4f6d-40e2-988d-a714ff966c39';
  await db.query(`UPDATE readings SET result = jsonb_set(result, '{reportId}', to_jsonb($1::text))`, [invalidId]);
  await db.query('UPDATE report_orders SET report_id = $1', [invalidId]);
  const before = await reading();
  expect(await store.claimPaidRework({ readingId: 50, expectedReportId: invalidId, reportId: newId, actorId: 9, reason: 'Attempt recovery of known invalid facts' })).toEqual({ outcome: 'invalid_snapshot' });
  expect(await reading()).toEqual(before);
  expect((await db.query<any>('SELECT report_id FROM report_orders')).rows[0].report_id).toBe(invalidId);
});

it('requires the original snapshot and does not partially claim', async () => {
  await db.exec(`UPDATE readings SET result = result - 'metadata'`);
  expect(await claim()).toMatchObject({ outcome: 'missing_snapshot' });
  expect((await reading()).pipeline_callback_hash).toBe('old-hash');
});

it('records bounded terminal failure evidence for the current queued attempt and allows privileged recovery', async () => {
  await db.exec(`UPDATE readings SET pipeline_status = 'queued', pipeline_callback_hash = NULL`);
  expect((store as any).recordPipelineFailure).toEqual(expect.any(Function));
  const evidence = { reportId: oldId, executionId: '219', failedNode: 'Build Revision Prompt', failedAt: new Date(Date.now() - 1000).toISOString(), status: 'failed' };
  expect(await (store as any).recordPipelineFailure(evidence)).toBe('applied');
  expect(await (store as any).recordPipelineFailure(evidence)).toBe('duplicate');
  expect((await reading()).pipeline_status).toBe('queued');
  expect(await claim()).toMatchObject({ outcome: 'claimed' });
  expect((await reading()).result.reworkHistory[0].result.failureEvidence).toMatchObject(evidence);
  expect(await (store as any).recordPipelineFailure(evidence)).toBe('not_found');
});

it.each(['approved', 'rejected', 'needs_editor'])('never records failure against terminal/review state %s', async (status) => {
  await db.query('UPDATE readings SET pipeline_status = $1', [status]);
  expect(await store.recordPipelineFailure({ reportId: oldId, executionId: '219', failedNode: 'Writer', failedAt: new Date(Date.now() - 1000).toISOString(), status: 'failed' })).toBe('conflict');
});
it.each([-8 * 86400000, 60000, -2 * 3600000])('rejects stale, future, or pre-attempt failure evidence (%s ms)', async (offset) => {
  await db.exec(`UPDATE readings SET pipeline_status = 'queued'`);
  expect(await store.recordPipelineFailure({ reportId: oldId, executionId: '219', failedNode: 'Writer', failedAt: new Date(Date.now() + offset).toISOString(), status: 'failed' })).toBe('conflict');
  expect((await reading()).result).not.toHaveProperty('failureEvidence');
});
it.each([{ status: 'running' }, { executionId: '' }, { failedNode: 'x'.repeat(121) }, { failedAt: 'not-a-date' }, { stack: 'private' }])('rejects malformed/overbroad evidence %j', async (override) => {
  expect(await store.recordPipelineFailure({ reportId: oldId, executionId: '219', failedNode: 'Writer', failedAt: new Date().toISOString(), status: 'failed', ...override })).toBe('invalid');
});
it('racing approval and recovery never attaches old prose to the new attempt', async () => {
  await db.exec(`UPDATE readings SET pipeline_status = 'queued', pipeline_callback_hash = NULL`);
  await store.recordPipelineFailure({ reportId: oldId, executionId: '219', failedNode: 'Writer', failedAt: new Date(Date.now() - 1000).toISOString(), status: 'failed' });
  await Promise.all([claim(), applyPipelineCallback({ reportId: oldId, status: 'approved', pipelineValue: { status: 'approved', sections: ['old'] }, callbackHash: 'late' })]);
  const r = await reading();
  if (r.result.reportId === newId) {
    expect(r.pipeline_status).toBe('queued');
    expect(r.result.pipeline).toEqual({ status: 'queued' });
  } else {
    expect(r.pipeline_status).toBe('approved');
    expect(r.result).not.toHaveProperty('reworkHistory');
  }
});

it('rolls back the reading/history/hash if order correlation update fails', async () => {
  await db.exec(`ALTER TABLE report_orders ADD CONSTRAINT reject_test_correlation CHECK (report_id <> '${newId}')`);
  try {
    await expect(claim()).rejects.toThrow();
    const r = await reading();
    expect(r.result).toEqual(original);
    expect(r.pipeline_callback_hash).toBe('old-hash');
    expect(r.pipeline_status).toBe('rejected');
  } finally {
    await db.exec('ALTER TABLE report_orders DROP CONSTRAINT reject_test_correlation');
  }
});
it('a subsequent rejection/rework appends history without changing prior attempts', async () => {
  await claim();
  const firstHistory = (await reading()).result.reworkHistory;
  await applyPipelineCallback({ reportId: newId, status: 'rejected', pipelineValue: { status: 'rejected' }, callbackHash: 'second-hash' });
  expect(await store.claimPaidRework({ readingId: 50, expectedReportId: newId, reportId: '44444444-4444-4444-8444-444444444444', actorId: 9, reason: 'Second quality repair' })).toMatchObject({ outcome: 'claimed' });
  const r = await reading();
  expect(r.result.reworkHistory).toHaveLength(2);
  expect(r.result.reworkHistory[0]).toEqual(firstHistory[0]);
  expect(r.result.reworkHistory[1].callbackHash).toBe('second-hash');
  expect(r.result.metadata).toEqual(original.metadata);
});

it('claims a consumed paid rejection without payment, preserving its full prior attempt and original snapshot', async () => {
  expect((store as any).claimPaidRework).toEqual(expect.any(Function));
  const orderBefore = (await db.query<any>('SELECT * FROM report_orders')).rows[0];
  expect(await claim()).toMatchObject({ outcome: 'claimed', reportId: newId, snapshot: original.metadata });
  const r = await reading();
  expect(r.pipeline_status).toBe('queued');
  expect(r.pipeline_callback_hash).toBeNull();
  expect(r.result.metadata).toEqual(original.metadata);
  expect(r.result.pipeline).toEqual({ status: 'queued' });
  expect(r.result.reworkHistory).toEqual([expect.objectContaining({ reportId: oldId, status: 'rejected', callbackHash: 'old-hash', result: original, actorId: 9 })]);
  const orderAfter = (await db.query<any>('SELECT * FROM report_orders')).rows[0];
  expect(orderAfter).toEqual({ ...orderBefore, report_id: newId, updated_at: expect.any(Date) });
  expect((await db.query('SELECT * FROM readings')).rows).toHaveLength(1);
});
