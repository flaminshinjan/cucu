import Anthropic from "@anthropic-ai/sdk";
import { env, capabilities } from "../env";

let _client: Anthropic | null = null;
function client(): Anthropic | null {
  if (!capabilities.hasAnthropic) return null;
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicKey });
  return _client;
}

export type LLMTier = "fast" | "smart";

export interface LLMOptions {
  system: string;
  prompt: string;
  tier?: LLMTier;
  maxTokens?: number;
  temperature?: number;
  /** Called with each text delta (real streaming with Anthropic, simulated with mock) */
  onDelta?: (text: string) => void;
  /** When set, mock returns this fixture deterministically */
  mockFixture?: string;
}

export async function llmText(opts: LLMOptions): Promise<string> {
  const c = client();
  const model = opts.tier === "smart" ? env.modelSonnet : env.modelHaiku;

  if (!c) {
    return mockStream(opts);
  }

  let full = "";
  const stream = await c.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  stream.on("text", (delta) => {
    full += delta;
    opts.onDelta?.(delta);
  });

  await stream.finalMessage();
  return full;
}

/** Calls llmText and parses the response as JSON. Strips ```json fences. */
export async function llmJSON<T>(opts: LLMOptions): Promise<T> {
  const text = await llmText(opts);
  return parseJSON<T>(text);
}

export function parseJSON<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

/** Word-by-word streaming of a fixture so the UI feels alive without a key */
async function mockStream(opts: LLMOptions): Promise<string> {
  const text = opts.mockFixture ?? "{}";
  if (!opts.onDelta) return text;

  const tokens = text.match(/(\s+|[^\s]+)/g) ?? [text];
  for (const t of tokens) {
    opts.onDelta(t);
    // small jitter for a believable "agent thinking" feel
    await new Promise((r) => setTimeout(r, 8 + Math.random() * 18));
  }
  return text;
}
