// /lib/groq.ts — Groq SDK wrapper (mirrors old app's lib/groq.js)
import Groq from 'groq-sdk';

let _client: any;
function getClient() {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

export const GROQ_MODEL = 'llama-3.1-8b-instant';

export async function generateText(
  prompt: string,
  options: { systemPrompt?: string; model?: string; temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const { systemPrompt, model = GROQ_MODEL, temperature = 0.8, max_tokens = 2000 } = options;
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await getClient().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}
