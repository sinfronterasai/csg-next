import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import sharp, { type Metadata } from "sharp";
import { submissionAuth } from "@/lib/blog/submissionAuth";
import { assertSanityWriteConfigured, sanityWriteClient } from "@/lib/sanity/write";
import { BodyTooLarge, readLimitedBody } from "@/lib/blog/limitedBody";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
export async function POST(request: Request) {
  const auth = submissionAuth(request);
  if (auth !== "ok") return NextResponse.json({ error: auth === "unconfigured" ? "Submission service not configured" : "Unauthorized" }, { status: auth === "unconfigured" ? 503 : 401 });
  try { assertSanityWriteConfigured(); } catch { return NextResponse.json({ error: "Asset service not configured" }, { status: 503 }); }
  try {
    const data = await readLimitedBody(request, MAX_FILE_BYTES + 65536);
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "" }, body: new Uint8Array(data) }).formData();
    if (form.getAll("file").length !== 1) return NextResponse.json({ error: "One image file is required" }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "One image file is required" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    let metadata: Metadata;
    try { metadata = await sharp(bytes, { limitInputPixels: 40000000 }).metadata(); }
    catch { return NextResponse.json({ error: "Unsupported image" }, { status: 422 }); }
    const formats: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const mime = formats[metadata.format || ""];
    if (!mime || !metadata.width || !metadata.height || (metadata.pages || 1) !== 1) return NextResponse.json({ error: "Unsupported image" }, { status: 422 });
    // Header metadata alone can look valid for truncated or corrupt files.
    // Decode pixels before sending the original bytes to Sanity.
    try { await sharp(bytes, { limitInputPixels: 40000000 }).stats(); }
    catch { return NextResponse.json({ error: "Unsupported or corrupt image" }, { status: 422 }); }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const asset = await sanityWriteClient.assets.upload("image", bytes, { contentType: mime, filename: `csg-${digest}.${metadata.format === "jpeg" ? "jpg" : metadata.format}` });
    return NextResponse.json({ assetId: asset._id, width: metadata.width, height: metadata.height, format: metadata.format, contentType: mime, size: bytes.length, sha256: digest }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BodyTooLarge) return NextResponse.json({ error: "File too large" }, { status: 413 });
    console.error("[content/assets] upload failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }
}
