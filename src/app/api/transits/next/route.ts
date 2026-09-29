import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  calculateNextTransit,
  isNextTransitCalculationError,
  isNextTransitInputError,
  NEXT_TRANSIT_CONTRACT_VERSION,
  NEXT_TRANSIT_EXPERIMENT_ID,
  type NextTransitRequest,
} from '@/lib/nextTransit';

export const runtime = 'nodejs';

function event(name: string, idempotencyKey: string) {
  return {
    name,
    experimentId: NEXT_TRANSIT_EXPERIMENT_ID,
    route: '/transits',
    contractVersion: NEXT_TRANSIT_CONTRACT_VERSION,
    idempotencyKey,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  let body: NextTransitRequest;
  try {
    body = await request.json() as NextTransitRequest;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON.' }, { status: 400 });
  }

  const idempotencyKey = `${NEXT_TRANSIT_EXPERIMENT_ID}:${randomUUID()}`;
  const events = [event('next_transit_started', idempotencyKey)];
  try {
    const result = await calculateNextTransit(body);
    return NextResponse.json({ result, events: [...events, event('next_transit_completed', idempotencyKey)] });
  } catch (error) {
    const status = isNextTransitInputError(error) ? 400 : isNextTransitCalculationError(error) ? 422 : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Next major transit calculation failed.',
      events: [...events, event('next_transit_error', idempotencyKey)],
    }, { status });
  }
}
