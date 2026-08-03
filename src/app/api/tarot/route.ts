import { NextResponse } from 'next/server';

// Real reading generation is implemented in Task 14. Until then, be explicit
// rather than returning a placeholder reading.
export async function POST() {
  return NextResponse.json(
    { error: 'Reading generation is not implemented yet. See Task 14.' },
    { status: 501 },
  );
}
