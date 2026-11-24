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
  markDefs: { _key: string; _type: "link"; href: string }[];
  style: string;
  listItem?: string;
}

let counter = 0;

function key(): string {
  counter += 1;
  return `k${counter.toString(36)}`;
}

function spans(text: string, markDefs: PortableBlock["markDefs"]): PortableSpan[] {
  const out: PortableSpan[] = [];
  const re = /(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      out.push({ _key: key(), _type: "span", marks: [], text: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("[")) {
      const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const href = match[2];
      if (!/^(?:\/(?!\/)|https?:\/\/|mailto:)/i.test(href)) throw new Error("Unsupported link destination");
      const linkKey = key();
      markDefs.push({ _key: linkKey, _type: "link", href });
      out.push({ _key: key(), _type: "span", marks: [linkKey], text: match[1] });
    } else if (token.startsWith("**")) {
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
  const markDefs: PortableBlock["markDefs"] = [];
  const value: PortableBlock = {
    _key: key(),
    _type: "block",
    children: spans(text, markDefs),
    markDefs,
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
export interface PortableImage {
  _type: "image";
  _key: string;
  asset: { _type: "reference"; _ref: string };
  alt: string;
  caption?: string;
}

export function markdownToPortableText(markdown: string, images: Record<string, PortableImage> = {}): (PortableBlock | PortableImage)[] {
  // Keys need only be unique within this document. Stable output also permits
  // safe recovery if Sanity succeeds and the database transaction fails.
  counter = 0;
  const blocks: (PortableBlock | PortableImage)[] = [];

  for (const raw of String(markdown || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const image = /^\[\[image:([a-z0-9-]+)\]\]$/.exec(line);
    if (image) {
      if (!images[image[1]]) throw new Error(`Unresolved image marker: ${image[1]}`);
      blocks.push(images[image[1]]);
    }
    else if (/^#{4,6}\s+/.test(line)) {
      const heading = /^(#{4,6})\s+(.+)$/.exec(line)!;
      blocks.push(block(heading[2], `h${heading[1].length}`));
    }
    else if (/^>\s+/.test(line)) blocks.push(block(line.replace(/^>\s+/, ""), "blockquote"));
    else if (/^###\s+/.test(line)) blocks.push(block(line.replace(/^###\s+/, ""), "h3"));
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
