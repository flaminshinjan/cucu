import type { BrandPersona, CustomBrief, ResearchOutput } from "../types";
import { search } from "../adapters/research";
import { llmJSON } from "../adapters/llm";
import { emit } from "../store";

export async function runResearcher(
  runId: string,
  persona: BrandPersona,
  brief?: CustomBrief,
): Promise<ResearchOutput> {
  // Effective research subject: brief overrides persona when present.
  const focus = brief?.focus?.trim() || persona.industry;
  const audience = brief?.audience?.trim() || persona.audience;
  const url = brief?.url?.trim();

  emit(runId, {
    ts: Date.now(),
    agent: "researcher",
    type: "thinking",
    message: url
      ? `Researching ${focus} for ${url}…`
      : `Pulling trending topics for ${focus}…`,
    data: brief ? { brief } : undefined,
  });

  // Three parallel searches: trends, competitors, pain points.
  // When a URL is given, swap the third query for a brand-specific dive.
  const queries = [
    `latest trends ${focus} ${new Date().getFullYear()}`,
    `competitor content angles ${focus}`,
    url
      ? `${url} ${focus} positioning`
      : `audience pain points ${audience}`,
  ];

  emit(runId, {
    ts: Date.now(),
    agent: "researcher",
    type: "tool-call",
    message: "search.tavily",
    data: { queries },
  });

  const results = await Promise.all(queries.map((q) => search({ query: q, maxResults: 4 })));
  const allHits = results.flat();

  emit(runId, {
    ts: Date.now(),
    agent: "researcher",
    type: "tool-result",
    message: `${allHits.length} sources gathered`,
    data: { count: allHits.length, sample: allHits.slice(0, 3).map((h) => h.title) },
  });

  // Synthesize with Haiku
  emit(runId, {
    ts: Date.now(),
    agent: "researcher",
    type: "thinking",
    message: "Summarizing findings with Haiku 4.5…",
  });

  const system = `You are a sharp content researcher. Given web search results, a brand persona, and (optionally) a custom brief from the operator, extract the 5 most useful findings for content strategy. Each finding should be either a "trend", "competitor" angle, "pain-point", or "format" idea. When the custom brief specifies a focus topic or brand URL, weight findings toward that focus. Return strict JSON.`;

  const prompt = `Brand persona:
- Name: ${persona.name}
- Industry: ${persona.industry}
- Audience: ${audience}
- Pillars: ${persona.pillars.join("; ")}
${
  brief && (brief.focus || brief.url || brief.audience)
    ? `\nCustom brief (overrides where applicable):
- Focus: ${brief.focus || "(none)"}
- Brand URL: ${brief.url || "(none)"}
- Specific audience: ${brief.audience || "(none)"}`
    : ""
}

Web sources:
${allHits
  .map((h, i) => `[${i + 1}] ${h.title}\n${h.content}\n${h.url ?? ""}`)
  .join("\n\n")}

Return JSON in this shape (no markdown, just JSON):
{
  "findings": [
    { "topic": "short topic", "why": "1 sentence why it matters for this brand", "signal": "trend|competitor|pain-point|format", "source": "url" }
  ],
  "summary": "2-sentence narrative summary",
  "topAngles": ["angle A", "angle B", "angle C"]
}`;

  const out = await llmJSON<ResearchOutput>({
    tier: "fast",
    system,
    prompt,
    maxTokens: 1500,
    onDelta: (t) => {
      emit(runId, {
        ts: Date.now(),
        agent: "researcher",
        type: "delta",
        data: { text: t },
      });
    },
    mockFixture: buildMockFinding(persona),
  });

  emit(runId, {
    ts: Date.now(),
    agent: "researcher",
    type: "result",
    message: `Distilled ${out.findings.length} findings · ${out.topAngles.length} candidate angles`,
    data: out,
  });

  return out;
}

function buildMockFinding(p: BrandPersona): string {
  const isB2B = p.id === "b2b-saas-founder";
  return JSON.stringify(
    isB2B
      ? {
          findings: [
            {
              topic: "Activation dashboards inflate funnel health 60–80%",
              why: "Strong contrarian hook for an audience that respects numbers and is allergic to vanity metrics.",
              signal: "pain-point",
              source: "https://example.com/activation-dashboard-lies",
            },
            {
              topic: "Warehouse-native > SDK-first for PLG instrumentation",
              why: "Aligns with the brand's wedge against incumbents — concrete DX story.",
              signal: "trend",
              source: "https://example.com/plg-instrumentation",
            },
            {
              topic: "Time-to-first-value < 9 min → 2.3× paid conversion",
              why: "Specific number → quotable hook. Threadable into a 5-tweet teardown.",
              signal: "trend",
              source: "https://example.com/plg-activation",
            },
            {
              topic: "41% of growth leads regret their analytics stack within 12 months",
              why: "Validates the audience's frustration. Strong LinkedIn open.",
              signal: "competitor",
              source: "https://example.com/analytics-buyer-fatigue",
            },
            {
              topic: "Activation benchmarks by ACV — sub-$10k vs $25k+ ICPs",
              why: "Educational, save-bait. Strong Reels carousel or X mini-thread.",
              signal: "format",
              source: "https://example.com/activation-benchmarks",
            },
          ],
          summary:
            "The audience is mid-funnel: convinced PLG matters, exhausted by their current stack. The winning content positions Lumen as the 'finally, the numbers stop lying' option — concrete benchmarks beat ideology.",
          topAngles: [
            "Your activation dashboard is lying to you",
            "Three numbers every PLG founder should run weekly",
            "Why warehouse-native is the new floor for analytics",
          ],
        }
      : {
          findings: [
            {
              topic: "Only 18% of recreational lifters track weekly progressive overload",
              why: "Crisp contrarian stat that aligns with Maya's 'rep quality > vibes' pillar.",
              signal: "pain-point",
              source: "https://example.com/progressive-overload",
            },
            {
              topic: "Women 30–45 are the fastest-growing strength segment (34% YoY)",
              why: "Validates Maya's ICP and supports a credibility-anchoring hook.",
              signal: "trend",
              source: "https://example.com/strength-demographic",
            },
            {
              topic: "Sleep <7h costs 14–22% of lifting performance",
              why: "Reframes 'I don't have time to train' into 'I don't have time to undertrain recovery'.",
              signal: "pain-point",
              source: "https://example.com/recovery-basics",
            },
            {
              topic: "3 lifting + 2 recovery walks outperforms 5-day splits for working women",
              why: "Direct counter-programming for influencer noise. Strong Reel.",
              signal: "competitor",
              source: "https://example.com/recovery-programming",
            },
            {
              topic: "Form-focused content underperforms on views but 3× retention",
              why: "Justifies Maya's editorial discipline; reassures her that the slow burn wins.",
              signal: "format",
              source: "https://example.com/form-vs-volume",
            },
          ],
          summary:
            "Working women 30–45 are saturated with intensity-first content and hungry for permission to train less but smarter. Specifics (numbers, schedules, science) beat vibes by a wide margin.",
          topAngles: [
            "The 3-day-a-week strength plan that beats 5-day splits",
            "Why your sleep is your most undertrained muscle",
            "Form is boring. Form also wins.",
          ],
        },
  );
}
