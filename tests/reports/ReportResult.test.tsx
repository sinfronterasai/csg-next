/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReportResult from "@/components/reports/ReportResult";
import type { ReportRow, ReportSection } from "@/lib/reportEngine";

const overview: ReportRow[] = [
  { glyph: "☉", label: "Sun", value: "♊ Gemini @ 84°3' (H10)", note: "" },
  { glyph: "☽", label: "Moon", value: "♓ Pisces @ 344°15' (H7)", note: "Retrograde" },
];
const sections: ReportSection[] = [
  { heading: "Your Cosmic Identity", body: "**Sun** in Gemini." },
  { heading: "How to Read This Chart", body: "Layer 1 above is your map." },
];

describe("ReportResult structured rendering", () => {
  it("renders the Layer-1 overview table with labels and values", () => {
    render(<ReportResult type="natal" overview={overview} sections={sections} />);
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText(/Gemini @ 84°3'/)).toBeTruthy();
    expect(screen.getByText("Moon")).toBeTruthy();
  });

  it("renders each Layer-2 section as an expandable heading", () => {
    render(<ReportResult type="natal" overview={overview} sections={sections} />);
    expect(screen.getByText("Your Cosmic Identity")).toBeTruthy();
    expect(screen.getByText("How to Read This Chart")).toBeTruthy();
  });

  it("does NOT dump raw markdown (no '# ' heading syntax) into the DOM", () => {
    const { container } = render(<ReportResult type="natal" overview={overview} sections={sections} />);
    expect(container.textContent).not.toContain("# Natal Birth Chart Report");
  });

  it("shows PDF and Share action buttons", () => {
    render(<ReportResult type="natal" title="Natal Birth Chart Report" overview={overview} sections={sections} />);
    expect(screen.getByText("Download PDF")).toBeTruthy();
    expect(screen.getByText("Share")).toBeTruthy();
  });

  it("Share copies the link to clipboard and reflects 'Link Copied' (jsdom fallback)", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: undefined, clipboard: { writeText } });
    render(<ReportResult type="natal" title="Natal Birth Chart Report" overview={overview} sections={sections} shareUrl="https://x.test/reports" />);
    const shareBtn = screen.getByText("Share");
    fireEvent.click(shareBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://x.test/reports"));
    await waitFor(() => expect(screen.getByText("Link Copied")).toBeTruthy());
  });
});
