import { NextResponse } from 'next/server';
import { unsubscribeEmail } from '@/lib/email/subscriptions';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try {
    await unsubscribeEmail(token);
    return new NextResponse('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>You are unsubscribed</h1><p>We will stop marketing messages for this address.</p></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Unsubscribe link unavailable</h1><p>Please contact support@cosmicspiritguide.com.</p></body></html>', { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
