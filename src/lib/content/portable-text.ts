export interface PortableTextSpan {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: string;
  markDefs: never[];
  children: PortableTextSpan[];
}

function keyFor(prefix: string, index: number): string {
  return prefix + index.toString(36);
}

/** Strip inline emphasis markers so no raw syntax reaches the reader. */
export function stripInline(text: string): string {
  return text.split("**").join("").split("__").join("").split("*").join("").trim();
}

function paragraph(
  text: string,
  style: string,
  index: number,
  extra: { listItem?: string; level?: number } = {},
): PortableTextBlock {
  const key = keyFor("b", index);
  return {
    _type: "block",
    _key: key,
    style,
    markDefs: [],
    children: [{ _type: "span", _key: keyFor(key + "s", 0), text: stripInline(text), marks: [] }],
    ...extra,
  } as PortableTextBlock;
}

const BULLET_PREFIXES = ["- ", "* ", "+ "];

function headingLevel(line: string): number {
  let level = 0;
  while (level < line.length && line[level] === "#") level += 1;
  if (level < 2 || level > 6) return 0;
  if (line[level] !== " ") return 0;
  return level;
}

function isNumbered(line: string): boolean {
  const dot = line.indexOf(". ");
  const paren = line.indexOf(") ");
  const cut = dot >= 0 ? dot : paren;
  if (cut <= 0) return false;
  const digits = line.slice(0, cut);
  return digits.length > 0 && digits.split("").every((c) => c >= "0" && c <= "9");
}

function numberedBody(line: string): string {
  const dot = line.indexOf(". ");
  const paren = line.indexOf(") ");
  const cut = dot >= 0 ? dot : paren;
  return line.slice(cut + 2).trim();
}

export function markdownToPortableText(markdown: string): PortableTextBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: PortableTextBlock[] = [];
  let index = 0;
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join(" ").trim();
    buffer = [];
    if (text) blocks.push(paragraph(text, "normal", index++));
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    // The article title is stored separately in `title`, so an H1 is skipped.
    if (trimmed.startsWith("# ")) {
      flush();
      continue;
    }

    const level = headingLevel(trimmed);
    if (level) {
      flush();
      const style = level === 2 ? "h2" : level === 3 ? "h3" : "h4";
      blocks.push(paragraph(trimmed.slice(level + 1).trim(), style, index++));
      continue;
    }

    const bulletPrefix = BULLET_PREFIXES.find((p) => trimmed.startsWith(p));
    if (bulletPrefix) {
      flush();
      blocks.push(
        paragraph(trimmed.slice(bulletPrefix.length).trim(), "normal", index++, {
          listItem: "bullet",
          level: 1,
        }),
      );
      continue;
    }

    if (isNumbered(trimmed)) {
      flush();
      blocks.push(
        paragraph(numberedBody(trimmed), "normal", index++, { listItem: "number", level: 1 }),
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      flush();
      blocks.push(paragraph(trimmed.slice(1).trim(), "blockquote", index++));
      continue;
    }

    buffer.push(trimmed);
  }

  flush();
  return blocks;
}

export function countWords(markdown: string): number {
  return markdown
    .split("\n")
    .map((line) => stripInline(line.replace(/^#+/, "").replace(/^>/, "")))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}
