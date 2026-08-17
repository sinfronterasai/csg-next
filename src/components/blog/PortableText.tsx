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

  return (
    <div className="space-y-6 leading-relaxed text-cosmic-200">
      {blocks.map((block: any, i: number) => {
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
