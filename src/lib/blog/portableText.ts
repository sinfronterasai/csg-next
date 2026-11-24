export interface PortableSpan {
  _key: string;
  _type: "span";
  marks: string[];
  text: string;
}

export interface PortableBlock {
  _key: string;
  _type: "block";
  children: PortableSpan[];
  markDefs: never[];
  style: string;
  listItem?: string;
}

let counter = 0;

function key(): string {
  counter += 1;
  return `k${Date.now().toString(36)}${counter.toString(36)}`;
}

function spans(text: string): PortableSpan[] {
  const out: PortableSpan[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      out.push({ _key: key(), _type: "span", marks: [], text: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      out.push({ _key: key(), _type: "span", marks: ["strong"], text: token.slice(2, -2) });
    } else {
      out.push({ _key: key(), _type: "span", marks: ["em"], text: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    out.push({ _key: key(), _type: "span", marks: [], text: text.slice(last) });
  }
  if (!out.length) {
    out.push({ _key: key(), _type: "span", marks: [], text });
  }
  return out;
}

function block(text: string, style: string, listItem?: string): PortableBlock {
  const value: PortableBlock = {
    _key: key(),
    _type: "block",
    children: spans(text),
    markDefs: [],
    style,
  };
  if (listItem) value.listItem = listItem;
  return value;
}

/**
 * Convert the markdown body produced by the writer into Sanity Portable Text.
 * Mirrors the block shapes already present in the production dataset
 * (`block` with `children` spans, `markDefs`, and a `style` of normal/h2/h3).
 */
export function markdownToPortableText(markdown: string): PortableBlock[] {
  const blocks: PortableBlock[] = [];

  for (const raw of String(markdown || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (/^###\s+/.test(line)) blocks.push(block(line.replace(/^###\s+/, ""), "h3"));
    else if (/^##\s+/.test(line)) blocks.push(block(line.replace(/^##\s+/, ""), "h2"));
    else if (/^#\s+/.test(line)) blocks.push(block(line.replace(/^#\s+/, ""), "h2"));
    else if (/^[-*]\s+/.test(line)) blocks.push(block(line.replace(/^[-*]\s+/, ""), "normal", "bullet"));
    else if (/^\d+\.\s+/.test(line)) blocks.push(block(line.replace(/^\d+\.\s+/, ""), "normal", "number"));
    else blocks.push(block(line, "normal"));
  }

  return blocks;
}

/**
 * Clip to a hard character ceiling on a word boundary.
 *
 * Sanity enforces metaTitle <= 60 and metaDescription <= 160. Truncating
 * mid-word produces visibly broken SEO copy, so prefer the last space when it
 * is not too far back, then strip trailing punctuation.
 */
export function clipWords(value: string, max: number): string {
  const text = String(value || "").trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const clipped = space > max * 0.6 ? cut.slice(0, space) : cut;
  return clipped.replace(/[\s,;:.\-]+$/, "");
}
