import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { processWhopPayment } from '@/lib/whop';
import { GET as access } from '@/app/api/tarot/relationship-access/route';
import { POST as generate } from '@/app/api/tarot/generate/route';
let db: PGlite;
jest.mock('@/lib/db', () => ({
  query: async (sql:string,values?:any[]) => {const r=await db.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows};},
  transaction: (fn:any) => fn(async (sql:string,values?:any[]) => {const r=await db.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows};}),
}));
jest.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'local-test-only'})})}));
jest.mock('@/lib/auth',()=>({verifyToken:()=>({userId:'7'})}));
jest.mock('@/lib/groq',()=>({generateText:async()=> 'Synthetic integration test interpretation. Not a customer sample.'}));
jest.mock('@/lib/tarot/astrology',()=>({getAstrologyOverlay:async()=>null}));
beforeAll(async()=> {
  db=new PGlite();
  await db.exec(`CREATE TABLE users (id int PRIMARY KEY,email text,subscription_tier text);
    CREATE TABLE whop_payment_events (payment_id text PRIMARY KEY,state text,plan_id text,email text,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE whop_entitlements (id serial PRIMARY KEY,user_id int,email text,offer text,plan_id text,payment_id text UNIQUE,status text,granted_at timestamptz,updated_at timestamptz,revoked_at timestamptz);
    CREATE TABLE report_orders (provider text,provider_payment_id text,status text,updated_at timestamptz);
    CREATE TABLE readings (id serial PRIMARY KEY,user_id int,type text,spread_id text,question text,category text,reading_type text,result jsonb,meta jsonb,created_at timestamptz);
    INSERT INTO users VALUES (7,'buyer@example.com','free');`);
},20000);
afterAll(async()=>{await db.close();});
it('unlocks only after confirmed payment, persists a reading, and revokes access on refund/replay',async()=>{
  const request=()=>new NextRequest('http://localhost/api/tarot/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({spreadId:'relationship_dynamics',question:'How can I communicate more clearly?',seed:'local-integration'})});
  expect(await (await access()).json()).toEqual({status:'locked'});
  expect((await generate(request())).status).toBe(403);
  const payment={paymentId:'local-test-payment',email:'BUYER@example.com',planId:'plan_FojHN8WK5oMKA'};
  expect(await processWhopPayment({...payment,eventType:'payment.succeeded'})).toMatchObject({applied:true,userId:7});
  expect(await (await access()).json()).toEqual({status:'unlocked'});
  const reading=await generate(request());
  expect(reading.status).toBe(200);
  const result = await reading.json();
  expect(result).toMatchObject({spreadId:'relationship_dynamics',readingId:expect.any(Number)});
  expect(result.drawn).toHaveLength(6);
  expect((await db.query('SELECT id FROM readings WHERE user_id=7')).rows).toHaveLength(1);
  expect(await processWhopPayment({...payment,eventType:'payment.succeeded'})).toMatchObject({applied:false,reason:'duplicate'});
  expect(await processWhopPayment({...payment,eventType:'refund.created'})).toMatchObject({applied:true});
  expect(await (await access()).json()).toEqual({status:'locked'});
  expect((await generate(request())).status).toBe(403);
  expect(await processWhopPayment({...payment,eventType:'payment.succeeded'})).toMatchObject({applied:false,reason:'already-refunded'});
  expect(await (await access()).json()).toEqual({status:'locked'});
},20000);
