jest.mock("@/lib/sanity/write", () => ({ assertSanityWriteConfigured: jest.fn(), sanityWriteClient: {} }));
import { POST } from "@/app/api/content/submissions/route";

describe("content submission staging endpoint", () => {
  const previous = process.env.CSG_CONTENT_SUBMISSION_TOKEN;
  afterAll(() => {
    if (previous === undefined) delete process.env.CSG_CONTENT_SUBMISSION_TOKEN;
    else process.env.CSG_CONTENT_SUBMISSION_TOKEN = previous;
  });

  it("rejects a wrong credential and malformed authenticated input", async () => {
    process.env.CSG_CONTENT_SUBMISSION_TOKEN = "test-secret";
    const bad = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer wrong" } }));
    expect(bad.status).toBe(401);
    const good = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
    expect(good.status).toBe(400);
    expect(await good.json()).toEqual({ error: "Malformed JSON" });
  });

  it("fails closed when its credential is missing", async () => {
    delete process.env.CSG_CONTENT_SUBMISSION_TOKEN;
    const result = await POST(new Request("https://example.test", { method: "POST" }));
    expect(result.status).toBe(503);
  });
  it("limits request bodies even without a content length header", async () => {
    process.env.CSG_CONTENT_SUBMISSION_TOKEN = "test-secret";
    const result = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret" }, body: "x".repeat(1024 * 1024 + 1) }));
    expect(result.status).toBe(413);
  });
});
