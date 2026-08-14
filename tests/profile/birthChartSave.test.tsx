/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BirthChartPage from "@/app/birth-chart/page";

// Mock fetch: first call (compute) returns a chart; we assert the second call
// (save) hits /api/birth-chart with the birth payload.
const computeChart = {
  name: "Alex",
  birth: { date: "1990-06-15", time: "12:00", location: "Paris, France", latitude: 48.8566, longitude: 2.3522, unknownTime: false },
  planets: [
    { key: "sun", label: "Sun", glyph: "☉", longitude: 84.3, degreeInSign: 24.3, sign: "gemini", signLabel: "Gemini", signGlyph: "♊", house: 10, retrograde: false, dignity: null, description: "" },
    { key: "moon", label: "Moon", glyph: "☽", longitude: 344.3, degreeInSign: 14.3, sign: "pisces", signLabel: "Pisces", signGlyph: "♓", house: 7, retrograde: false, dignity: null, description: "" },
  ],
  angles: [
    { key: "asc", label: "Ascendant", longitude: 120, sign: "leo", signLabel: "Leo", signGlyph: "♌", degreeInSign: 0 },
    { key: "mc", label: "Midheaven", longitude: 30, sign: "taurus", signLabel: "Taurus", signGlyph: "♉", degreeInSign: 0 },
  ],
  houses: [
    { num: 1, label: "1st House", area: "Self", cuspLongitude: 120, sign: "leo", signLabel: "Leo", signGlyph: "♌", description: "" },
    { num: 2, label: "2nd House", area: "Resources", cuspLongitude: 150, sign: "virgo", signLabel: "Virgo", signGlyph: "♍", description: "" },
  ],
  ascendant: { key: "asc", label: "Ascendant", longitude: 120, sign: "leo", signLabel: "Leo", signGlyph: "♌", degreeInSign: 0 },
  midheaven: { key: "mc", label: "Midheaven", longitude: 30, sign: "taurus", signLabel: "Taurus", signGlyph: "♉", degreeInSign: 0 },
  sun: { key: "sun", label: "Sun", glyph: "☉", longitude: 84.3, degreeInSign: 24.3, sign: "gemini", signLabel: "Gemini", signGlyph: "♊", house: 10, retrograde: false, dignity: null, description: "" },
  moon: { key: "moon", label: "Moon", glyph: "☽", longitude: 344.3, degreeInSign: 14.3, sign: "pisces", signLabel: "Pisces", signGlyph: "♓", house: 7, retrograde: false, dignity: null, description: "" },
};

describe("Birth chart create flow persists to profile", () => {
  it("POSTs the computed chart to /api/birth-chart (save) after computing", async () => {
    const calls: { url: string; body: any }[] = [];
    (global as any).fetch = jest.fn(async (url: string, init?: any) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      if (url === "/api/chart") {
        return { ok: true, json: async () => computeChart } as any;
      }
      if (url === "/api/birth-chart") {
        return { ok: true, json: async () => ({ success: true, chartId: 1, chart: computeChart }) } as any;
      }
      return { ok: false, json: async () => ({}) } as any;
    });

    render(<BirthChartPage />);
    fireEvent.change(screen.getByPlaceholderText("Alex"), { target: { value: "Alex" } });
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "1990-06-15" } });
    // time input
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: "12:00" } });
    fireEvent.change(screen.getByPlaceholderText("Paris, France"), { target: { value: "Paris, France" } });

    fireEvent.click(screen.getByText("Cast Celestial Chart"));

    await waitFor(() => {
      const save = calls.find((c) => c.url === "/api/birth-chart");
      expect(save).toBeTruthy();
      expect(save!.body).toMatchObject({ date: "1990-06-15", time: "12:00", location: "Paris, France" });
    });
  });
});
