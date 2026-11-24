export class BodyTooLarge extends Error {}

// Enforce the limit even when Content-Length is absent or dishonest.
export async function readLimitedBody(request: Request, max: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length") || 0) > max) throw new BodyTooLarge();
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) { await reader.cancel(); throw new BodyTooLarge(); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
