import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getEntitlement } from "@/lib/tarot/entitlements";
import { getSpread } from "@/lib/tarot/spreads";
import { makeSeed } from "@/lib/tarot/draw";
import { generateReading } from "@/lib/tarot/generate";

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let tier = "free";
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.userId;
        const ent = await getEntitlement(decoded.userId);
        tier = ent.tier;
      }
    }
  } catch {
    userId = null;
    tier = "free";
  }

  const body = await request.json().catch(() => ({}));
  const spreadId = typeof body.spreadId === "string" ? body.spreadId : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!spreadId || !question) {
    return NextResponse.json({ error: "spreadId and question are required." }, { status: 400 });
  }
  const spread = getSpread(spreadId);
  if (!spread) {
    return NextResponse.json({ error: "Unknown spread." }, { status: 404 });
  }

  // Entitlement gate: free users may only draw free spreads.
  const { spreadTierMet } = await import("@/lib/tarot/entitlements");
  if (!spreadTierMet(spread.tier, tier as any)) {
    return NextResponse.json(
      { error: "This spread is a Premium feature. Upgrade to draw it.", code: "UPGRADE_REQUIRED", spreadId },
      { status: 403 },
    );
  }

  const seed = typeof body.seed === "string" ? body.seed : makeSeed(spreadId + ":" + userId + ":" + Date.now());

  try {
    const reading = await generateReading({
      spreadId,
      question,
      seed,
      userId,
      category: typeof body.category === "string" ? body.category : null,
    });
    return NextResponse.json({
      spreadId: reading.spreadId,
      question: reading.question,
      drawn: reading.drawn.map((d) => ({
        name: d.card.name,
        reversed: d.reversed,
        artRef: d.card.artRef,
        positionLabel: d.positionLabel,
        upright: d.card.upright,
        reversedMeaning: d.card.reversed,
      })),
      interpretation: reading.interpretation,
      astrology: reading.astrology,
      readingId: reading.readingId,
    });
  } catch (err: any) {
    // Never return a fake reading. Surface the real failure.
    return NextResponse.json(
      { error: "Reading generation failed. Our interpreter is unavailable right now.", detail: String(err?.message || err) },
      { status: 502 },
    );
  }
}
