// Minimal, dependency-free Markdown renderer for report section bodies.
// The report engine emits a small, controlled Markdown subset (bold **x**,
// bullet "- " lines, paragraphs). We render that to React nodes so the
// raw "**" markers never reach the DOM as literal text. Only the subset the
// engine produces is supported; anything else is passed through as text.
import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  // Split on **bold** and *italic* segments (engine emits both, e.g.
  // "How to Read This Chart" uses *Sun*/*Moon* for emphasis).
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return <em key={i}>{italic[1]}</em>;
    return <span key={i}>{part}</span>;
  });
}

export function renderMarkdown(body: string): ReactNode {
  const lines = body.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  let key = 0;
  const flushList = () => {
    if (list.length) {
      out.push(<ul key={`l${key++}`} className="list-disc pl-5 space-y-1">{list}</ul>);
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      list.push(<li key={`i${key++}`}>{renderInline(bullet[1])}</li>);
      continue;
    }
    flushList();
    out.push(<p key={`p${key++}`} className="mb-2">{renderInline(line)}</p>);
  }
  flushList();
  return <>{out}</>;
}
