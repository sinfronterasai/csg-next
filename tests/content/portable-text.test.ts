import { markdownToPortableText, type PortableBlock, type PortableImage } from "@/lib/blog/portableText";

describe("editorial Portable Text conversion", () => {
  it("preserves links, section styles and the image at its intended position", () => {
    const image: PortableImage = { _key: "img-1", _type: "image", asset: { _type: "reference", _ref: "image-example" }, alt: "A wheel" };
    const result = markdownToPortableText("## Heading\nRead [our chart](/birth-chart).\n[[image:wheel]]\n> Reflection\n#### Detail", { wheel: image });
    expect((result[0] as PortableBlock).style).toBe("h2");
    const paragraph = result[1] as PortableBlock;
    expect(paragraph.markDefs).toEqual([expect.objectContaining({ _type: "link", href: "/birth-chart" })]);
    expect(paragraph.children.find((span) => span.text === "our chart")?.marks).toContain(paragraph.markDefs[0]._key);
    expect(result[2]).toEqual(image);
    expect((result[3] as PortableBlock).style).toBe("blockquote");
    expect((result[4] as PortableBlock).style).toBe("h4");
  });

  it("rejects missing image references and unsafe link schemes", () => {
    expect(() => markdownToPortableText("[[image:missing]]")).toThrow("Unresolved image marker");
    expect(() => markdownToPortableText("[click](javascript:alert)")).toThrow("Unsupported link destination");
  });
});
