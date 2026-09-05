import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function request(path: string, headers: Record<string, string>) {
  return new NextRequest(`https://cosmicspiritguide.com${path}`, { headers });
}

describe("production /profile noindex regression", () => {
  test("emits noindex for /profile on production bare host", () => {
    const response = middleware(request("/profile", { host: "cosmicspiritguide.com" }));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("emits noindex for /profile on production www host", () => {
    const response = middleware(request("/profile", { host: "www.cosmicspiritguide.com" }));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
