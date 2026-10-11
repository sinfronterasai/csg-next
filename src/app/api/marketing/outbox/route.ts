import { NextResponse } from 'next/server';
import { processEmailOutbox, processSequenceSteps } from '@/lib/email/subscriptions';

const ROUTE = '/api/marketing/outbox';

type ProcessingPhase = 'outbox' | 'sequence';

function safeErrorDetails(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : 'Unknown error';
  const message = rawMessage
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted-token]')
    .slice(0, 240);

  return {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: message,
  };
}

function logFailure(phase: ProcessingPhase, startedAt: number, error: unknown) {
  console.error(`[marketing/outbox] ${phase} processing failed`, {
    route: ROUTE,
    phase,
    durationMs: Date.now() - startedAt,
    ...safeErrorDetails(error),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.RESEND_OUTBOX_CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!secret || !authorization) {
    console.warn('[marketing/outbox] unauthorized request', {
      route: ROUTE,
      reason: !secret ? 'server_secret_missing' : 'authorization_header_missing',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (authorization !== `Bearer ${secret}`) {
    console.warn('[marketing/outbox] unauthorized request', {
      route: ROUTE,
      reason: 'authorization_invalid',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let processed: number;
  try {
    processed = await processEmailOutbox(50);
  } catch (error) {
    logFailure('outbox', startedAt, error);
    return NextResponse.json({ error: 'Outbox processing failed', phase: 'outbox' }, { status: 500 });
  }

  let sequenceProcessed: number;
  try {
    sequenceProcessed = await processSequenceSteps(50);
  } catch (error) {
    logFailure('sequence', startedAt, error);
    return NextResponse.json({ error: 'Outbox processing failed', phase: 'sequence' }, { status: 500 });
  }

  console.info('[marketing/outbox] processing completed', {
    route: ROUTE,
    durationMs: Date.now() - startedAt,
    processed,
    sequenceProcessed,
  });

  return NextResponse.json({ ok: true, processed, sequenceProcessed });
}
