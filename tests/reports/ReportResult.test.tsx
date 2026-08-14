/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
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
});
