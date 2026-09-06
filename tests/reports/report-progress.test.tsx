/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import ReportProgress from "@/components/reports/ReportProgress";

type Status = "queued" | "processing" | "checking" | "approved" | "rejected" | "needs_editor";

const READING_ID = 42;
const REPORT_ID = "report-42";
const originalFetch = global.fetch;

function responseFor(status: Status): Response {
  const approved = status === "approved";
  const rejected = status === "rejected" || status === "needs_editor";
  return {
    ok: true,
    json: async () => ({
      reports: [{
        id: READING_ID,
        reportId: REPORT_ID,
        title: "Birth Chart Report",
        type: "natal",
        status,
        overview: approved
          ? [{ glyph: "☉", label: "Sun", value: "Aries 12°", note: "Core self" }]
          : [],
        // This is the exact public API contract, not the internal callback shape.
        sections: approved
          ? [{ id: "coreIdentity", prose: "Approved section prose." }]
          : [],
        pending: !approved && !rejected,
        createdAt: "2026-09-06T00:00:00.000Z",
      }],
    }),
  } as Response;
}

async function advancePoll(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(3_000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ReportProgress", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("polls queued -> processing -> checking -> approved and renders approved sections in place", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(responseFor("queued"))
      .mockResolvedValueOnce(responseFor("processing"))
      .mockResolvedValueOnce(responseFor("checking"))
      .mockResolvedValueOnce(responseFor("approved"));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReportProgress readingId={READING_ID} type="natal" />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Your chart is in the constellation room/i)).toBeInTheDocument();

    await advancePoll();
    expect(screen.getByText(/Writing your personalized interpretation/i)).toBeInTheDocument();

    await advancePoll();
    expect(screen.getByText(/Checking every claim against your chart/i)).toBeInTheDocument();

    await advancePoll();
    expect(screen.getByText("Core Identity")).toBeInTheDocument();
    expect(screen.getByText("Approved section prose.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    // Approved is terminal: a further interval must not issue another request.
    await advancePoll();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});


  it("fails closed for a legacy needs_editor payload without human-review UX or report prose", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockResolvedValueOnce(responseFor("needs_editor"));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReportProgress readingId={READING_ID} type="natal" />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/did not pass our quality checks/i)).toBeInTheDocument();
    expect(screen.queryByText(/final review|in review|human editor|editor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Approved section prose/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
