import type { ReadingRecord } from "@/lib/tarot/store";

export interface HistoryItem {
  id: number;
  spreadId: string;
  question: string;
  category: string | null;
  astrologySummary: string | null;
  createdAt: string;
}

export interface HistoryResponse {
  count: number;
  items: HistoryItem[];
}

/** Map stored readings into a compact history view (newest first). */
export function buildHistoryResponse(readings: ReadingRecord[]): HistoryResponse {
  const items: HistoryItem[] = [...readings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({
      id: r.id,
      spreadId: r.spreadId ?? "",
      question: r.question,
      category: r.category ?? null,
      astrologySummary: r.astrology && typeof r.astrology === "object" && typeof (r.astrology as any).summary === "string"
        ? (r.astrology as any).summary
        : null,
      createdAt: r.createdAt,
    }));
  return { count: items.length, items };
}
