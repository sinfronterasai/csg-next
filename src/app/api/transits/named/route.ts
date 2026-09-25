import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
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

const ASSIGNMENT_COOKIE = 'csg_named_transit_assignment';
const FEATURE_FLAG = 'CSG_NAMED_TRANSIT_EXPERIMENT';

type Assignment = 'treatment' | 'control';

function enabled(): boolean {
  return process.env[FEATURE_FLAG] === 'true' || process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT === 'true';
}

function assignmentFromCookie(value: string | undefined): Assignment | null {
  return value === 'treatment' || value === 'control' ? value : null;
}

function newAssignment(): Assignment {
  return Number.parseInt(randomUUID().slice(0, 2), 16) % 2 === 0 ? 'control' : 'treatment';
}

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

function setAssignmentCookie(response: NextResponse, assignment: Assignment, shouldSet: boolean): NextResponse {
  if (shouldSet) {
    response.cookies.set(ASSIGNMENT_COOKIE, assignment, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}

export async function POST(request: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: 'Named transit experiment is not enabled.' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let body: NamedTransitRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON.' }, { status: 400 });
  }

  const existingAssignment = assignmentFromCookie(cookieStore.get(ASSIGNMENT_COOKIE)?.value);
  const assignment = existingAssignment || newAssignment();
  const idempotencyKey = `${NAMED_TRANSIT_EXPERIMENT_ID}:${randomUUID()}`;
  const events = [
    event('named_transit_eligible', assignment, idempotencyKey),
    event('named_transit_assigned', assignment, idempotencyKey),
    event('named_transit_started', assignment, idempotencyKey),
  ];

  if (assignment === 'control') {
    return setAssignmentCookie(
      NextResponse.json({ experimentId: NAMED_TRANSIT_EXPERIMENT_ID, assignment, events }),
      assignment,
      !existingAssignment,
    );
  }

  try {
    const result = await calculateNamedTransit(body);
    return setAssignmentCookie(
      NextResponse.json({
        experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
        assignment,
        result,
        events: [...events, event('named_transit_completed', assignment, idempotencyKey)],
      }),
      assignment,
      !existingAssignment,
    );
  } catch (error) {
    const status = isNamedTransitInputError(error) ? 400 : isNamedTransitCalculationError(error) ? 422 : 500;
    return setAssignmentCookie(
      NextResponse.json({
        error: error instanceof Error ? error.message : 'Named transit calculation failed.',
        experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
        assignment,
        events: [...events, event('named_transit_error', assignment, idempotencyKey)],
      }, { status }),
      assignment,
      !existingAssignment,
    );
  }
}
