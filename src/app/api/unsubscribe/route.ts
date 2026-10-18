import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/campaign/archetype';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const token = url.searchParams.get('token') || '';
  if (!email || !verifyUnsubscribeToken(email, token)) return new NextResponse('Invalid unsubscribe link.', { status: 400 });
  return new NextResponse(`<!doctype html><title>Confirm unsubscribe</title><p>Confirm that you want to stop Cosmic Spirit Guide promotional emails.</p><form method="post"><input type="hidden" name="email" value="${email.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"/><input type="hidden" name="token" value="${token.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"/><button type="submit">Confirm unsubscribe</button></form>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.text();
  const form = new URLSearchParams(body);
  const email = (form.get('email') || url.searchParams.get('email') || '').trim().toLowerCase();
  const token = form.get('token') || url.searchParams.get('token') || '';
  if (!email || !verifyUnsubscribeToken(email, token)) return new NextResponse('Invalid unsubscribe link.', { status: 400 });
  await query(`UPDATE csg_campaign_subscribers SET marketing_opt_in=false, unsubscribed_at=now(), updated_at=now() WHERE email=$1`, [email]);
  return new NextResponse('<!doctype html><title>Unsubscribed</title><p>You have been unsubscribed from Cosmic Spirit Guide promotional emails.</p>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}