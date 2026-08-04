import { buildHistoryResponse } from "@/lib/tarot/historyApi";
import type { ReadingRecord } from "@/lib/tarot/store";

const recs: ReadingRecord[] = [
  {
    id: 1, userId: 9, spreadId: "celtic_cross", question: "Q1", category: "career",
    positions: [], cards: [], interpretation: "r1", astrology: null, createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: 2, userId: 9, spreadId: "one_card", question: "Q2", category: null,
    positions: [], cards: [], interpretation: "r2", astrology: { summary: "Sun in Pisces" }, createdAt: "2026-08-03T10:00:00Z",
  },
];

describe("buildHistoryResponse (pure)", () => {
  it("returns readings mapped to a UI shape, newest first", () => {
    const res = buildHistoryResponse(recs);
    expect(res.count).toBe(2);
    expect(res.items[0].id).toBe(2); // newer first
    expect(res.items[1].id).toBe(1);
    expect(res.items[0]).toMatchObject({ spreadId: "one_card", question: "Q2", astrologySummary: "Sun in Pisces" });
  });

  it("returns empty list for no readings", () => {
    const res = buildHistoryResponse([]);
    expect(res.count).toBe(0);
    expect(res.items).toEqual([]);
  });

  it("astrologySummary is null when no overlay", () => {
    const res = buildHistoryResponse([recs[0]]);
    expect(res.items[0].astrologySummary).toBeNull();
  });
});
