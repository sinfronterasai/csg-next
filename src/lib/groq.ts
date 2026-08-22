// /lib/groq.ts — Groq SDK wrapper (mirrors old app's lib/groq.js)
import Groq from "groq-sdk";

let _client: any;
function getClient() {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

// Updated 2026-08-22: llama-3.1-8b-instant was retired by Groq (model_not_found).
// qwen/qwen3.6-27b is a chat model this key can reach.
export const GROQ_MODEL = "qwen/qwen3.6-27b";

export async function generateText(
  prompt: string,
  options: { systemPrompt?: string; model?: string; temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const { systemPrompt, model = GROQ_MODEL, temperature = 0.8, max_tokens = 2000 } = options;
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const response = await getClient().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
    // qwen/qwen3.6-27b is a reasoning model that emits a <think>...</think> block by
    // default. We only want the final reading, so disable the thinking step entirely.
    // (Strip logic below is kept as defense-in-depth in case a future model re-enables it.)
    reasoning_effort: "none",
  });
  let content = response.choices?.[0]?.message?.content ?? "";
  content = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/<\/think>/gi, "")
    .trim();
  return content;
}
