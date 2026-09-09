import { NextResponse } from 'next/server';
import { verifyCallbackToken } from '@/lib/reportPipeline';
import { recordPipelineFailure } from '@/lib/billing/reportPurchaseStore';

// Server-to-server only, using the existing callback authentication convention.
// The trusted failure reporter must inspect the actual terminal n8n execution
// and propagate the app correlation, not infer failure from elapsed queue time.
export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (!verifyCallbackToken(auth?.startsWith('Bearer ') ? auth.slice(7) : null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 2048) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Malformed body' }, { status: 400 }); }
    const outcome = await recordPipelineFailure(body);
    const status = { applied: 200, duplicate: 200, conflict: 409, not_found: 404, invalid: 400 }[outcome];
    return NextResponse.json({ outcome }, { status });
  } catch {
    return NextResponse.json({ error: 'Failure report unavailable' }, { status: 500 });
  }
}
