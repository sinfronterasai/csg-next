import crypto from 'crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  const primitive = JSON.stringify(value);
  if (primitive === undefined) throw new Error('cannot canonicalize undefined');
  return primitive;
}

export function canonicalSha256(value: unknown): string {
  return crypto.createHash('sha256').update(Buffer.from(canonicalJson(value), 'utf8')).digest('hex');
}
