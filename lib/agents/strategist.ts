import type { BrandPersona, ResearchOutput, StrategyOutput } from "../types";
import { llmJSON } from "../adapters/llm";
import { emit } from "../store";

export async function runStrategist(
  runId: string,
  persona: BrandPersona,
  research: ResearchOutput,
): Promise<StrategyOutput> {
  emit(runId, {
    ts: Date.now(),
    agent: "strategist",
    type: "thinking",
    message: "Designing content pillars and a weekly cadence…",
  });

  const system = `You are a senior content strategist. Given a brand persona and research findings, produce:
1. Three content pillars (each with one-line rationale tied to the audience pain points).
2. A 7-day weekly plan (one entry per day) — each maps a pillar to a format and includes a punchy hook.
3. One "hero" angle for this content run — the single best angle to express across four platforms.
4. A format mix recommendation per platform (linkedin, youtube, instagram, x).

Voice rules: respect the persona's voiceAttributes and avoid forbiddenWords. Be specific, not generic.
Return strict JSON only — no markdown, no commentary.`;

  const prompt = `Brand: ${persona.name}
Tagline: ${persona.tagline}
Industry: ${persona.industry}
Audience: ${persona.audience}
Voice attributes: ${persona.voiceAttributes.join(", ")}
Existing pillars (use as starting point): ${persona.pillars.join("; ")}
Forbidden words: ${(persona.forbiddenWords ?? []).join(", ") || "(none)"}

Research summary: ${research.summary}

Top candidate angles:
${research.topAngles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Findings:
${research.findings.map((f, i) => `${i + 1}. [${f.signal}] ${f.topic} — ${f.why}`).join("\n")}

Return JSON in this exact shape:
{
  "pillars": [{ "name": "...", "rationale": "..." }, ...],
  "weeklyPlan": [
    { "day": "Mon", "pillar": "...", "format": "...", "hook": "..." }, ...
  ],
  "hero": { "angle": "...", "hypothesis": "why this will land", "pillar": "..." },
  "formatMix": {
    "linkedin": "format description",
    "youtube": "format description",
    "instagram": "format description",
    "x": "format description"
  }
}`;

  const out = await llmJSON<StrategyOutput>({
    tier: "smart",
    system,
    prompt,
    maxTokens: 2200,
    onDelta: (t) =>
      emit(runId, {
        ts: Date.now(),
        agent: "strategist",
        type: "delta",
        data: { text: t },
      }),
    mockFixture: buildMockStrategy(persona, research),
  });

  emit(runId, {
    ts: Date.now(),
    agent: "strategist",
    type: "result",
    message: `Strategy locked · hero angle: "${out.hero.angle}"`,
    data: out,
  });

  return out;
}

function buildMockStrategy(p: BrandPersona, r: ResearchOutput): string {
  const isB2B = p.id === "b2b-saas-founder";
  return JSON.stringify(
    isB2B
      ? {
          pillars: [
            {
              name: "Activation, decoded",
              rationale:
                "The audience is tired of vanity dashboards. Tactical, number-led content positions Lumen as the credible alternative.",
            },
            {
              name: "PLG instrumentation, without the data-team queue",
              rationale:
                "Speaks directly to the founder pain of waiting weeks on instrumentation. Reinforces the wedge.",
            },
            {
              name: "What ‘good’ looks like by ICP",
              rationale:
                "Benchmarks build trust faster than thought leadership. Save-able, share-able content.",
            },
          ],
          weeklyPlan: [
            { day: "Mon", pillar: "Activation, decoded", format: "LinkedIn long-form", hook: "Your activation dashboard is lying to you. Here’s the math." },
            { day: "Tue", pillar: "PLG instrumentation, without the data-team queue", format: "X thread (6 tweets)", hook: "Most PLG products instrument in Q. We did it in days. The 5 SQL views we wrote." },
            { day: "Wed", pillar: "What ‘good’ looks like by ICP", format: "YT Shorts (45s)", hook: "Three activation numbers every founder should run weekly." },
            { day: "Thu", pillar: "Activation, decoded", format: "IG Reel (carousel)", hook: "Time-to-first-value under 9 minutes → 2.3× paid. Here’s why." },
            { day: "Fri", pillar: "PLG instrumentation, without the data-team queue", format: "LinkedIn poll", hook: "When you instrument, you should start with: A) events, B) views, C) a SQL question." },
            { day: "Sat", pillar: "What ‘good’ looks like by ICP", format: "X single", hook: "Sub-$10k ACV PLG: 35–45% activation is healthy. Above $25k: activation is a ceremony." },
            { day: "Sun", pillar: "Activation, decoded", format: "Long YT (re-cut)", hook: "Why dashboards lie — a 6-minute teardown." },
          ],
          hero: {
            angle: "Your activation dashboard is lying to you",
            hypothesis:
              "This is the highest-conviction frame for the audience this week — combines a sharp claim with a number the audience can verify in their own product.",
            pillar: "Activation, decoded",
          },
          formatMix: {
            linkedin: "Long-form post — story arc with one chart in mind. End on a question to drive comments.",
            youtube: "45–55s Short — face-to-camera, one visual cue per beat, captioned.",
            instagram: "Reel — voiceover with 3-slide visual callouts and save-worthy caption.",
            x: "6-tweet thread — each tweet a quotable claim with one supporting number.",
          },
        }
      : {
          pillars: [
            {
              name: "Strength that fits real life",
              rationale: "Directly counter-programs intensity-first content. Speaks to the audience’s schedule reality.",
            },
            {
              name: "The unsexy basics that win",
              rationale: "Sleep, protein, recovery — the audience is hungry for permission to deprioritize fluff.",
            },
            {
              name: "Form is the long game",
              rationale: "Builds Maya’s editorial credibility and creates evergreen, search-able content.",
            },
          ],
          weeklyPlan: [
            { day: "Mon", pillar: "Strength that fits real life", format: "IG Reel (45s)", hook: "3 lifting days + 2 recovery walks beats your 5-day split. Here’s why." },
            { day: "Tue", pillar: "The unsexy basics that win", format: "YT Shorts (50s)", hook: "Sleeping <7h costs you up to 22% of your lifts. Sleep is leg day." },
            { day: "Wed", pillar: "Form is the long game", format: "LinkedIn carousel", hook: "Form is boring. Form also wins. The science is annoying." },
            { day: "Thu", pillar: "Strength that fits real life", format: "X thread (5 tweets)", hook: "How to train for strength on 3 hours a week. Without crying or quitting." },
            { day: "Fri", pillar: "The unsexy basics that win", format: "IG carousel + caption", hook: "The 1.4g/kg protein number you’re probably under." },
            { day: "Sat", pillar: "Form is the long game", format: "YT long (re-cut)", hook: "A 6-minute deep-dive on rep quality." },
            { day: "Sun", pillar: "Strength that fits real life", format: "LinkedIn post", hook: "Why I program 3 days a week for working women — and what that gets them." },
          ],
          hero: {
            angle: "3 lifting days + 2 recovery walks beats your 5-day split",
            hypothesis:
              "Counter-programs the dominant influencer message, anchored on data the audience can feel. Strongest hook this week.",
            pillar: "Strength that fits real life",
          },
          formatMix: {
            linkedin: "Personal-voice post — Maya’s POV, story-arc, ends on a single ask.",
            youtube: "45–55s vertical Short — energetic but not yelling. Two visual cues.",
            instagram: "Reel — slower pace, save-bait caption, 5–7 mixed hashtags.",
            x: "5-tweet thread — punchy, quotable, no hashtags.",
          },
        },
  );
}
