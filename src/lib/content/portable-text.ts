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
