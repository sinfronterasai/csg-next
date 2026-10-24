import { PGlite } from '@electric-sql/pglite';
import { claimWhopReportPurchaseForUser } from '@/lib/billing/reportPurchaseStore';
let db: PGlite;
jest.mock('@/lib/db', () => ({
  query: async (sql: string, values?: any[]) => { const r = await db.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows }; },
  transaction: (fn: any) => fn(async (sql: string, values?: any[]) => { const r = await db.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows }; }),
}));
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE report_orders (id serial PRIMARY KEY, purchase_id uuid UNIQUE,
    user_id int, purchaser_email text, report_type text, provider text, status text,
    amount int DEFAULT 3900, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());`);
});
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec('DELETE FROM report_orders'); });
async function order(id: number, user: number | null, email = 'buyer@example.com', status = 'paid', type = 'natalpremium', provider = 'whop') {
  const uuid = `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
  await db.query(`INSERT INTO report_orders (purchase_id,user_id,purchaser_email,report_type,provider,status) VALUES ($1,$2,$3,$4,$5,$6)`, [uuid,user,email,type,provider,status]);
  return uuid;
}
const claim = () => claimWhopReportPurchaseForUser({ userId: 7, email: ' BUYER@example.com ', reportType: 'natalpremium' });
it.each([null, 7])('retrieves an order for a buyer whose account was %s at checkout', async (user) => {
  const id = await order(1, user);
  expect(await claim()).toMatchObject({ purchaseId: id, userId: 7, status: 'paid' });
  expect(await claim()).toMatchObject({ purchaseId: id, userId: 7 });
  expect((await db.query('SELECT * FROM report_orders')).rows).toHaveLength(1);
});
it('rejects another owner, a different email/type/provider, and refunded or unpaid orders', async () => {
  await order(1, 9); await order(2, null, 'other@example.com');
  await order(3, null, 'buyer@example.com', 'refunded'); await order(4, null, 'buyer@example.com', 'pending');
  await order(5, null, 'buyer@example.com', 'paid', 'transit'); await order(6, null, 'buyer@example.com', 'paid', 'natalpremium', 'stripe');
  expect(await claim()).toBeNull();
});
it('claims one unconsumed order and preserves an existing consumed report for repeat access', async () => {
  await order(1, 7, 'buyer@example.com', 'consumed');
  const paid = await order(2, null);
  await order(3, null, 'buyer@example.com', 'consumed');
  expect(await claim()).toMatchObject({ purchaseId: paid, status: 'paid' });
  expect((await db.query('SELECT * FROM report_orders WHERE user_id IS NULL')).rows).toHaveLength(1);
  await db.query("UPDATE report_orders SET status='consumed' WHERE purchase_id=$1", [paid]);
  expect(await claim()).toMatchObject({ purchaseId: paid, status: 'consumed', userId: 7 });
});
