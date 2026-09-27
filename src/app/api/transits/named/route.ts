import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  calculateNamedTransit,
  isNamedTransitCalculationError,
  isNamedTransitInputError,
  NAMED_TRANSIT_CONTRACT_VERSION,
  NAMED_TRANSIT_EXPERIMENT_ID,
  type NamedTransitRequest,
} from '@/lib/namedTransit';

export const runtime = 'nodejs';

type Assignment = 'treatment' | 'control';

function event(name: string, assignment: Assignment, idempotencyKey: string) {
  return {
    name,
    experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
    assignment,
    route: '/transits',
    contractVersion: NAMED_TRANSIT_CONTRACT_VERSION,
    idempotencyKey,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  let body: NamedTransitRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON.' }, { status: 400 });
  }

  const assignment: Assignment = 'treatment';
  const idempotencyKey = `${NAMED_TRANSIT_EXPERIMENT_ID}:${randomUUID()}`;
  const events = [
    event('named_transit_eligible', assignment, idempotencyKey),
    event('named_transit_assigned', assignment, idempotencyKey),
    event('named_transit_started', assignment, idempotencyKey),
  ];

  try {
    const result = await calculateNamedTransit(body);
    return NextResponse.json({
      experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
      assignment,
      result,
      events: [...events, event('named_transit_completed', assignment, idempotencyKey)],
    });
  } catch (error) {
    const status = isNamedTransitInputError(error) ? 400 : isNamedTransitCalculationError(error) ? 422 : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Named transit calculation failed.',
      experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
      assignment,
      events: [...events, event('named_transit_error', assignment, idempotencyKey)],
    }, { status });
  }
}
