import sharp from "sharp";
const upload = jest.fn(async (..._args: any[]) => ({ _id: `image-${"a".repeat(40)}-1200x630-png` }));
jest.mock("@/lib/sanity/write", () => ({ assertSanityWriteConfigured: () => {}, sanityWriteClient: { assets: { upload: (...args: unknown[]) => upload(...args) } } }));
import { POST } from "@/app/api/content/submissions/assets/route";

beforeEach(() => { process.env.CSG_CONTENT_SUBMISSION_TOKEN = "test-secret"; upload.mockClear(); });
afterAll(() => { delete process.env.CSG_CONTENT_SUBMISSION_TOKEN; });
it("detects the real image type instead of trusting the filename", async () => {
  const bytes = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], "wrong.jpg", { type: "image/jpeg" }));
  const response = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret" }, body: form }));
  expect(response.status).toBe(201);
  expect((await response.json()).format).toBe("png");
  expect(upload.mock.calls[0][2]).toEqual(expect.objectContaining({ contentType: "image/png" }));
});
it("rejects invalid bytes before upload and rejects unauthorized callers", async () => {
  const form = new FormData(); form.append("file", new File(["not an image"], "fake.png", { type: "image/png" }));
  const bad = await POST(new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret" }, body: form }));
  expect(bad.status).toBe(422);
  expect(upload).not.toHaveBeenCalled();
  expect((await POST(new Request("https://example.test", { method: "POST" }))).status).toBe(401);
});
