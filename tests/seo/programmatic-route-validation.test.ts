jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const { notFound } = require("next/navigation") as { notFound: jest.Mock };
const HoroscopeSignPage = require("@/app/horoscope/[sign]/page").default;
const TransitDatePage = require("@/app/transits/[date]/page").default;

describe("programmatic route parameter validation", () => {
  beforeEach(() => {
    notFound.mockClear();
  });

  test("invalid horoscope sign does not return an empty HTTP 200 page", async () => {
    await expect(
      HoroscopeSignPage({ params: Promise.resolve({ sign: "aries-today" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  test.each(["today", "2026-02-31", "2026-2-03", "not-a-date"])(
    "invalid transit date %s does not produce a programmatic page",
    async (date) => {
      await expect(
        TransitDatePage({ params: Promise.resolve({ date }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(1);
    },
  );
});
