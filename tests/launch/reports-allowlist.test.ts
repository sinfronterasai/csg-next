import { gateGeneration, isLaunchType, LAUNCH_FREE_TYPES, LAUNCH_PAID_TYPES } from "@/lib/launch/allowlist";

// C7: the server-authoritative launch allowlist must reject every non-allowed
// report type. After LB-PUBLIC hotfix, Love Blueprint is publicly available
// (no beta allowlist), but non-launch types remain blocked.
describe("reports launch allowlist (C7 server gate — post-LB-PUBLIC)", () => {
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

  it("Love Blueprint is publicly available — no beta allowlist gate (post-LB-PUBLIC)", () => {
    // After LB-PUBLIC: Love Blueprint is no longer gated by user ID.
    // Any authenticated user with a valid purchase can generate.
    expect(gateGeneration("loveblueprint", "999").allowed).toBe(true);
    expect(gateGeneration("loveblueprint", "999").code).toBeUndefined();
    expect(gateGeneration("loveblueprint", "1001").allowed).toBe(true);
    // The _userId param is kept for backward compatibility but ignored.
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
  // Post-LB-PUBLIC: $39 is allowed for Love Blueprint (public paid product).
  // Other prices for non-launch products remain banned.
  const BANNED_PRICES = ["$29", "$19", "$49", "$89", "$4.99", "$120"];

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
  it("renders the two authorized launch reports", () => {
    expect(src).toContain("Birth Chart Report");
    expect(src).toContain("Love Blueprint");
  });
  it("renders Love Blueprint with its $39 price (public paid product)", () => {
    expect(src).toContain("$39");
  });
});
