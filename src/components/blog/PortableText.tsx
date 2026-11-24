import type { ReactElement } from "react";
import Link from "next/link";
import { sanityImageUrl, safeAlt, type SanityImageSource } from "@/lib/sanity/image";

// Renders Sanity Portable Text: block elements (h1/h2/normal) with
// strong/em marks, plus inline/block images with non-empty alt text.
export function PortableText({
  value,
  imageFallback,
}: {
  value: unknown[];
  imageFallback: string;
}): ReactElement {
  const blocks = Array.isArray(value) ? value : [];
  const grouped: any[] = [];
  for (const block of blocks as any[]) {
    if (block?._type === "block" && (block.listItem === "bullet" || block.listItem === "number")) {
      const previous = grouped[grouped.length - 1];
      if (previous?._type === "_listGroup" && previous.kind === block.listItem) previous.items.push(block);
      else grouped.push({ _type: "_listGroup", kind: block.listItem, items: [block] });
    } else grouped.push(block);
  }

  return (
    <div className="space-y-6 leading-relaxed text-cosmic-200">
      {grouped.map((block: any, i: number) => {
        if (block?._type === "_listGroup") {
          const entries = block.items.map((item: any, n: number) => (
            <li key={item._key ?? n}><PortableText value={[{ ...item, listItem: undefined }]} imageFallback={imageFallback} /></li>
          ));
          return block.kind === "number"
            ? <ol key={i} className="list-decimal space-y-2 pl-7">{entries}</ol>
            : <ul key={i} className="list-disc space-y-2 pl-7">{entries}</ul>;
        }
        if (block?._type === "image") {
          const src = sanityImageUrl(block as SanityImageSource, { width: 1200, quality: 82 }) ||
            (block?._resolved?.url ?? null);
          const alt = safeAlt(block as SanityImageSource, imageFallback);
          if (!src) return null;
          return (
            <figure key={block._key ?? i} className="my-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                loading="lazy"
                className="w-full rounded-2xl border border-gold/20"
              />
              {block?.caption ? (
                <figcaption className="mt-2 text-center text-sm text-cosmic-400">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block?._type === "block") {
          const markDefs = (block.markDefs ?? []) as any[];
          const linkDefs: Record<string, any> = {};
          for (const md of markDefs) {
            if (md?._type === "link") linkDefs[md._key] = md;
          }
          const children = (block.children ?? []).map((child: any, ci: number) => {
            const marks = child.marks ?? [];
            let text: ReactElement = <>{child.text}</>;
            for (const m of marks) {
              if (m === "strong") text = <strong className="text-cosmic-100">{text}</strong>;
              else if (m === "em") text = <em>{text}</em>;
              else if (linkDefs[m]) {
                const def = linkDefs[m];
                const href: string = def?.href || "#";
                const cls = "text-gold underline-offset-4 hover:underline";
                text = href.startsWith("/")
                  ? <Link href={href} className={cls}>{text}</Link>
                  : <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{text}</a>;
              }
            }
            return <span key={ci}>{text}</span>;
          });

          const style = block.style ?? "normal";
          if (style === "h1") {
            return (
              <h1 key={block._key ?? i} className="font-serif text-3xl font-bold text-gold pt-4">
                {children}
              </h1>
            );
          }
          if (style === "h2") {
            return (
              <h2 key={block._key ?? i} className="font-serif text-2xl font-semibold text-gold pt-3">
                {children}
              </h2>
            );
          }
          if (style === "h3") {
            return (
              <h3 key={block._key ?? i} className="font-serif text-xl font-semibold text-gold">
                {children}
              </h3>
            );
          }
          if (style === "h4") return <h4 key={block._key ?? i} className="font-serif text-lg font-semibold text-gold">{children}</h4>;
          if (style === "h5") return <h5 key={block._key ?? i} className="font-serif font-semibold text-gold">{children}</h5>;
          if (style === "h6") return <h6 key={block._key ?? i} className="font-serif font-semibold text-gold">{children}</h6>;
          if (style === "blockquote") {
            return (
              <blockquote key={block._key ?? i} className="border-l-4 border-gold/50 pl-4 italic text-cosmic-300">
                {children}
              </blockquote>
            );
          }
          return (
            <p key={block._key ?? i} className="text-lg">
              {children}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}

export default PortableText;
