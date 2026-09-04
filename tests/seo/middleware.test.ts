import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

function request(path: string, headers: Record<string, string>) {
  return new NextRequest(`https://csg-next.onrender.com${path}`, { headers });
}

describe("preview noindex middleware", () => {
  test("adds noindex to normal preview responses", () => {
    const response = middleware(request("/about", { host: "csg-next.onrender.com" }));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("adds noindex to legacy redirects on preview hosts", () => {
    const response = middleware(request("/coach", { host: "csg-next.onrender.com" }));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://cosmicspiritguide.com/services");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("uses Host before a client-supplied production forwarded host", () => {
    const response = middleware(request("/about", {
      host: "csg-next.onrender.com",
      "x-forwarded-host": "cosmicspiritguide.com",
    }));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("runs for robots and sitemap responses", () => {
    expect(config.matcher).toContain("/robots.txt");
    expect(config.matcher).toContain("/sitemap.xml");
  });
});
