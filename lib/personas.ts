import type { BrandPersona } from "./types";
import { llmJSON } from "./adapters/llm";
import { uid } from "./utils";

const MOCK_FIXTURES: Record<string, BrandPersona> = {
  fintech: {
    id: "derived",
    name: "Stripe",
    tagline: "Payments infrastructure for the internet.",
    industry: "Fintech — Payments infrastructure",
    audience: "Engineering leaders and SMB operators integrating cross-border payments",
    voiceAttributes: ["Direct", "Developer-first", "Specific over generic", "Lightly authoritative"],
    pillars: ["Cross-border payments", "API DX", "SMB enablement"],
    forbiddenWords: ["leverage", "synergy"],
    primaryColor: "#635BFF",
    accentColor: "#A7A0FF",
    emoji: "💳",
    voiceGender: "female",
  },
  default: {
    id: "derived",
    name: "Your brand",
    tagline: "A modern brand telling a real story.",
    industry: "General",
    audience: "Operators and curious humans",
    voiceAttributes: ["Direct", "Specific", "Warm"],
    pillars: ["Strategy", "Stories", "Signals"],
    forbiddenWords: [],
    primaryColor: "#F24016",
    accentColor: "#FFAF8C",
    emoji: "✦",
    voiceGender: "female",
  },
};

/**
 * Turns a natural-language description of a brand into a fully-typed BrandPersona.
 * Uses Haiku 4.5 when an Anthropic key is present; otherwise returns a sensible
 * mock that picks a fixture based on a keyword in the message.
 */
export async function deriveBrand(message: string, runId?: string): Promise<BrandPersona> {
  const system = `You are a brand intake assistant. Given a free-text description of a brand or content goal, infer a full brand persona. Be specific, not generic. Prefer real-sounding details over hedged abstractions.

Return strict JSON only — no markdown, no commentary. Use this exact shape:
{
  "name": "Brand name (1-3 words)",
  "tagline": "One-line tagline that captures the brand POV",
  "industry": "Industry — short subtype",
  "audience": "1-2 sentence audience description — be specific about role, stage, company size, frustrations",
  "voiceAttributes": ["3-5 distinctive voice adjectives or short phrases"],
  "pillars": ["3 content pillars — concrete topics, not abstractions"],
  "forbiddenWords": ["2-5 corporate filler words to avoid OR empty array"],
  "primaryColor": "#RRGGBB (a deliberate brand color)",
  "accentColor": "#RRGGBB (a complementary lighter accent)",
  "emoji": "ONE emoji that fits",
  "voiceGender": "female | male | neutral"
}`;

  const prompt = `Brand brief from the operator:
"""
${message.trim()}
"""

Infer a complete brand persona. If the brief mentions a specific company, use what you know about that company. If it's a category or topic, invent a credible brand fit. If gender of voice isn't specified, prefer "female".`;

  const fixture = pickMockFixture(message);
  const derived = await llmJSON<Omit<BrandPersona, "id">>({
    tier: "fast",
    system,
    prompt,
    maxTokens: 800,
    mockFixture: JSON.stringify({
      name: fixture.name,
      tagline: fixture.tagline,
      industry: fixture.industry,
      audience: fixture.audience,
      voiceAttributes: fixture.voiceAttributes,
      pillars: fixture.pillars,
      forbiddenWords: fixture.forbiddenWords ?? [],
      primaryColor: fixture.primaryColor,
      accentColor: fixture.accentColor,
      emoji: fixture.emoji,
      voiceGender: fixture.voiceGender,
    }),
  });

  return {
    id: runId ? `derived_${runId}` : uid("derived_"),
    name: derived.name,
    tagline: derived.tagline,
    industry: derived.industry,
    audience: derived.audience,
    voiceAttributes: derived.voiceAttributes,
    pillars: derived.pillars,
    forbiddenWords: derived.forbiddenWords ?? [],
    primaryColor: normalizeHex(derived.primaryColor, "#F24016"),
    accentColor: normalizeHex(derived.accentColor, "#FFAF8C"),
    emoji: derived.emoji?.slice(0, 4) || "✦",
    voiceGender: derived.voiceGender === "male" || derived.voiceGender === "neutral"
      ? derived.voiceGender
      : "female",
  };
}

function normalizeHex(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const m = input.match(/#?[0-9a-fA-F]{6}/);
  if (!m) return fallback;
  return m[0].startsWith("#") ? m[0] : `#${m[0]}`;
}

function pickMockFixture(message: string): BrandPersona {
  const m = message.toLowerCase();
  if (m.includes("payment") || m.includes("stripe") || m.includes("fintech")) {
    return MOCK_FIXTURES.fintech;
  }
  return MOCK_FIXTURES.default;
}

/** Suggested chat prompts shown as one-click examples in the UI. */
export const EXAMPLE_BRIEFS: Array<{ label: string; text: string }> = [
  {
    label: "Strength coach for working women",
    text: "A strength training coach named Maya Strong for working women 30-45 who are tired of HIIT and want sustainable strength. Content should be science-backed and counter-program the influencer noise.",
  },
  {
    label: "PLG analytics tool",
    text: "Lumen Analytics — product analytics for non-PMs. Heads of Growth at seed-to-Series-B SaaS who are exhausted by Amplitude and data-team queues. Direct, numbers-over-adjectives, lightly contrarian.",
  },
  {
    label: "Stripe cross-border for SEA",
    text: "Make content for Stripe (https://stripe.com) about cross-border payments for SMBs in Southeast Asia. Audience is operators at $1-10M ARR SaaS companies.",
  },
];
