import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { updateReflection } from "@/lib/tarot/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const decoded = verifyToken(token);
  if (!decoded) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const reflection = typeof body.reflection === "string" ? body.reflection.slice(0, 5000) : "";
  const updated = await updateReflection(id, Number(decoded.userId), reflection);
  if (!updated) return NextResponse.json({ error: "Reading not found or not yours." }, { status: 404 });
  return NextResponse.json({ id: updated.id, reflection: updated.reflection });
}
