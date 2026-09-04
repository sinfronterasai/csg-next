import { escapeJsonLd, type JsonLdObject } from "@/lib/seo/jsonld";

export function SeoJsonLd({ data }: { data: JsonLdObject[] }) {
  return (
    <>
      {(data || []).map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(d)) }}
        />
      ))}
    </>
  );
}
