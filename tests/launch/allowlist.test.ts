import {
  isLaunchType,
  gateCheckout,
  gateGeneration,
  getLoveBlueprintBetaUserIds,
} from "@/lib/launch/allowlist";

describe("launch allowlist (constraint #7)", () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD };
    delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  });
  afterAll(() => {
    process.env = OLD;
  });

  test("only natal free + loveblueprint available", () => {
    expect(isLaunchType("natal")).toBe(true);
    expect(isLaunchType("loveblueprint")).toBe(true);
    for (const t of ["relationship", "transit", "lovetiming", "vocation", "karmicshadow", "fullcosmic"]) {
      expect(isLaunchType(t)).toBe(false);
    }
  });

  test("non-launch type rejected by both gates", () => {
    expect(gateCheckout("relationship", "u1").allowed).toBe(false);
    expect(gateGeneration("relationship", "u1").allowed).toBe(false);
    expect(gateCheckout("relationship", "u1").code).toBe("launch_unavailable");
  });

  test("loveblueprint blocked for non-allowlisted user by default", () => {
    expect(getLoveBlueprintBetaUserIds().size).toBe(0);
    expect(gateCheckout("loveblueprint", "u9").allowed).toBe(false);
    expect(gateCheckout("loveblueprint", "u9").code).toBe("beta_not_allowlisted");
    expect(gateGeneration("loveblueprint", "u9").allowed).toBe(false);
  });

  test("loveblueprint allowed for allowlisted beta user", () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = "u9, u10";
    expect(gateCheckout("loveblueprint", "u9").allowed).toBe(true);
    expect(gateGeneration("loveblueprint", "u10").allowed).toBe(true);
    expect(gateCheckout("loveblueprint", "u11").allowed).toBe(false);
  });

  test("natal free for anyone (no beta gate)", () => {
    expect(gateCheckout("natal", "u999").allowed).toBe(true);
    expect(gateGeneration("natal", "u999").allowed).toBe(true);
  });
});
