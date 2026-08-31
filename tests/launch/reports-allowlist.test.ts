import { gateGeneration, isLaunchType, LAUNCH_FREE_TYPES, LAUNCH_PAID_TYPES } from "@/lib/launch/allowlist";

// C7: the server-authoritative launch allowlist must reject every non-allowed
// report type, and gate Love Blueprint behind the beta allowlist. The public
// /reports UI hides those SKUs, but the API is the real enforcement boundary.
describe("reports launch allowlist (C7 server gate)", () => {
  const BANNED = [
    "relationship", "transit", "lovetiming", "vocation", "karmicshadow",
    "synastry", "composite", "fullcosmic", "couples",
  ];

  it("only Natal (free) and Love Blueprint (paid) are launch types", () => {
    expect(Array.from(LAUNCH_FREE_TYPES)).toEqual(["natal"]);
    expect(Array.from(LAUNCH_PAID_TYPES)).toEqual(["loveblueprint"]);
    for (const t of BANNED) expect(isLaunchType(t)).toBe(false);
  });

  it("every non-launch type is rejected by gateGeneration (404 path)", () => {
    for (const t of BANNED) {
      const g = gateGeneration(t, "999");
      expect(g.allowed).toBe(false);
      expect(g.code).toBe("launch_unavailable");
    }
  });

  it("natal is allowed for any user", () => {
    expect(gateGeneration("natal", "999").allowed).toBe(true);
  });

  it("Love Blueprint is invite-only: rejected unless beta-allowlisted", () => {
    const before = process.env.LOVEBLUEPRINT_BETA_USER_IDS;
    try {
      delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
      expect(gateGeneration("loveblueprint", "999").allowed).toBe(false);
      expect(gateGeneration("loveblueprint", "999").code).toBe("beta_not_allowlisted");

      process.env.LOVEBLUEPRINT_BETA_USER_IDS = "999,1000";
      expect(gateGeneration("loveblueprint", "999").allowed).toBe(true);
      expect(gateGeneration("loveblueprint", "1001").allowed).toBe(false);
    } finally {
      if (before === undefined) delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
      else process.env.LOVEBLUEPRINT_BETA_USER_IDS = before;
    }
  });
});

describe("public /reports UI hides non-launch SKUs (C7 defense-in-depth)", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.join(__dirname, "..", "..", "src/app/reports/ReportsView.tsx"),
    "utf8",
  );
  const BANNED_NAMES = [
    "Relationship Matrix", "Yearly Transit Forecast", "Love Timing Forecast",
    "Vocation & Wealth Map", "Karmic & Shadow Work", "Synastry Love Report",
    "Composite Chart Report", "Couples Cosmic Profile", "Full Cosmic Profile",
  ];
  const BANNED_PRICES = ["$39", "$29", "$19", "$49", "$89", "$4.99", "$120"];

  for (const name of BANNED_NAMES) {
    it(`does not render banned SKU "${name}"`, () => {
      expect(src).not.toContain(name);
    });
  }
  for (const price of BANNED_PRICES) {
    it(`does not render banned price "${price}"`, () => {
      expect(src).not.toContain(price);
    });
  }
  it("renders only the two authorized launch reports", () => {
    expect(src).toContain("Birth Chart Report");
    expect(src).toContain("Love Blueprint");
  });
});
