import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { listReadings } from "@/lib/tarot/store";
import { buildHistoryResponse } from "@/lib/tarot/historyApi";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const readings = await listReadings(Number(decoded.userId));
  return NextResponse.json(buildHistoryResponse(readings));
}
