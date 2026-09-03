import fs from "fs";
import path from "path";

const TRUST_PAGES = [
  "src/app/about/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
];

const FORBIDDEN = [
  /\[VERIFY/i,
  /\[add /i,
  /\[TODO/i,
  /\[FIXME/i,
  /\[Jurisdiction/i,
  /\[Published/i,
  /\[Keep this/i,
  /to be added before launch/i,
  /to be confirmed/i,
  /this page is a draft/i,
  /placeholder body/i,
  /is a placeholder/i,        // C8: must not call a launch-hold page a "placeholder"
  /this page is a placeholder/i,
  // NOTE: support@cosmicspiritguide.com is the REAL, monitored support channel
  // established by f307af5 (final legal/commercial copy, "real channel, monitored
  // support@cosmicspiritguide.com"). It is no longer an "invented" placeholder,
  // so it is intentionally NOT forbidden here. The placeholder/draft markers above
  // remain in force.
];

describe("trust/legal pages contain no visible placeholders or invented facts (B6)", () => {
  for (const rel of TRUST_PAGES) {
    it(`${rel} has no bracket/TODO/draft/invented-email markers`, () => {
      const abs = path.join(__dirname, "..", "..", rel);
      const src = fs.readFileSync(abs, "utf8");
      const hits = FORBIDDEN.filter((re) => re.test(src));
      expect(hits.join(" | ")).toBe("");
    });
  }
});
