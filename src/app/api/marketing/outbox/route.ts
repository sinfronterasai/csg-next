import { NextResponse } from 'next/server';
import { processEmailOutbox, processSequenceSteps } from '@/lib/email/subscriptions';

export async function POST(request: Request) {
  const secret = process.env.RESEND_OUTBOX_CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const processed = await processEmailOutbox(50);
  const sequenceProcessed = await processSequenceSteps(50);
  return NextResponse.json({ ok: true, processed, sequenceProcessed });
}
