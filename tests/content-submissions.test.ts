import { POST } from "@/app/api/content/submissions/route";

describe("content submission staging endpoint", () => {
  const previous = process.env.CSG_CONTENT_SUBMISSION_TOKEN;
  afterAll(() => {
    if (previous === undefined) delete process.env.CSG_CONTENT_SUBMISSION_TOKEN;
    else process.env.CSG_CONTENT_SUBMISSION_TOKEN = previous;
  });

  it("rejects a wrong credential and holds an authenticated submission closed", async () => {
    process.env.CSG_CONTENT_SUBMISSION_TOKEN = "test-secret";
    const bad = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer wrong" } }));
    expect(bad.status).toBe(401);
    const good = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
    expect(good.status).toBe(503);
    expect(await good.json()).toEqual({ error: "Submission format pending", outcome: "not_accepting_submissions" });
  });

  it("fails closed when its credential is missing", async () => {
    delete process.env.CSG_CONTENT_SUBMISSION_TOKEN;
    const result = await POST(new Request("https://example.test", { method: "POST" }));
    expect(result.status).toBe(503);
  });
});
