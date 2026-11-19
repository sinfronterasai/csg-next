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
