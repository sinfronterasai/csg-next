import { NextResponse } from "next/server";

// Retired: finished articles now arrive through the editorial submission API.
// Returning 410 makes stale schedulers harmless without deleting their history.
export async function POST() {
  return NextResponse.json(
    { error: "Legacy content generation is retired" },
    { status: 410 },
  );
}
