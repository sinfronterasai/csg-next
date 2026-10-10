import { NextResponse } from 'next/server';
import { confirmOptIn } from '@/lib/email/subscriptions';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try {
    await confirmOptIn(token);
    return new NextResponse('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Subscription confirmed</h1><p>You are now subscribed to Cosmic Spirit Guide emails.</p></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>Confirmation link unavailable</h1><p>Please submit the form again to request a fresh confirmation email.</p></body></html>', { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
