import type {
  AgentName,
  BrandPersona,
  PlatformCopy,
  PlatformId,
  ResearchOutput,
  StrategyOutput,
} from "../types";
import { PLATFORMS, PLATFORM_ORDER } from "../platforms";
import { llmJSON, llmText } from "../adapters/llm";
import { emit } from "../store";

const AGENT_MAP: Record<PlatformId, AgentName> = {
  linkedin: "copywriter-linkedin",
  youtube: "copywriter-youtube",
  instagram: "copywriter-instagram",
  x: "copywriter-x",
};

export async function runCopywriters(
  runId: string,
  persona: BrandPersona,
  research: ResearchOutput,
  strategy: StrategyOutput,
): Promise<PlatformCopy[]> {
  // Fire all four in parallel — this is the visible "agents working at once" moment
  for (const id of PLATFORM_ORDER) {
    emit(runId, {
      ts: Date.now(),
      agent: AGENT_MAP[id],
      type: "thinking",
      message: `Drafting ${PLATFORMS[id].name} copy on hero angle…`,
    });
  }

  // Isolate per-platform failures so one bad write can't crash the whole stage.
  // Each writeOne is wrapped: try once, retry once with a stricter "valid JSON only"
  // reminder, then fall back to a salvageable placeholder.
  const drafts = await Promise.all(
    PLATFORM_ORDER.map(async (p) => {
      try {
        return await writeOne(runId, persona, research, strategy, p);
      } catch (e1) {
        emit(runId, {
          ts: Date.now(),
          agent: AGENT_MAP[p],
          type: "thinking",
          message: `Retrying after parse error: ${truncate((e1 as Error)?.message)}`,
        });
        try {
          return await writeOne(runId, persona, research, strategy, p);
        } catch (e2) {
          emit(runId, {
            ts: Date.now(),
            agent: AGENT_MAP[p],
            type: "error",
            message: `Copy generation failed: ${truncate((e2 as Error)?.message)}. Using fallback.`,
          });
          return fallbackCopy(persona, strategy, p);
        }
      }
    }),
  );

  // Brand-voice consistency pass with Sonnet
  emit(runId, {
    ts: Date.now(),
    agent: "coordinator",
    type: "thinking",
    message: "Running brand-voice consistency pass across all four platforms…",
  });

  const consistent = await voiceConsistencyPass(runId, persona, drafts);

  for (const c of consistent) {
    emit(runId, {
      ts: Date.now(),
      agent: AGENT_MAP[c.platform],
      type: "result",
      message: `${PLATFORMS[c.platform].name} copy ready · ${c.meta.characterCount} chars`,
      data: c,
    });
  }

  return consistent;
}

async function writeOne(
  runId: string,
  persona: BrandPersona,
  research: ResearchOutput,
  strategy: StrategyOutput,
  platformId: PlatformId,
): Promise<PlatformCopy> {
  const platform = PLATFORMS[platformId];
  const agent = AGENT_MAP[platformId];

  const system = `You are a senior copywriter who writes only for ${platform.name}. Your single mission is to convert the hero angle into platform-perfect copy.

Voice rules for ${platform.name}:
${platform.voiceRules}

Brand voice:
- Attributes: ${persona.voiceAttributes.join(", ")}
- Forbidden words: ${(persona.forbiddenWords ?? []).join(", ") || "(none)"}

You return strict JSON only.`;

  const prompt = `Hero angle: ${strategy.hero.angle}
Hypothesis: ${strategy.hero.hypothesis}
Pillar: ${strategy.hero.pillar}
Format hint: ${strategy.formatMix[platformId]}

Brand: ${persona.name} — ${persona.tagline}
Audience: ${persona.audience}

Supporting findings:
${research.findings.slice(0, 3).map((f, i) => `${i + 1}. ${f.topic} — ${f.why}`).join("\n")}

Produce a single ${platform.name} post. Return JSON:
{
  "hook": "first line / first 3 seconds — the attention grab",
  "body": "main post body (follow the voice rules above for length and structure)",
  "cta": "one specific, concrete call to action",
  "hashtags": ["..."]  // empty array for X and LinkedIn long-form unless brand-canonical
}`;

  const out = await llmJSON<{ hook: string; body: string; cta: string; hashtags?: string[] }>({
    tier: "smart",
    system,
    prompt,
    maxTokens: 1500,
    onDelta: (t) =>
      emit(runId, {
        ts: Date.now(),
        agent,
        type: "delta",
        data: { text: t },
      }),
    mockFixture: buildMockCopy(persona, strategy, platformId),
  });

  const fullText = `${out.hook}\n\n${out.body}\n\n${out.cta}`;
  return {
    platform: platformId,
    hook: out.hook,
    body: out.body,
    cta: out.cta,
    hashtags: out.hashtags ?? [],
    meta: {
      characterCount: fullText.length,
      estimatedReadSeconds: Math.max(5, Math.round(fullText.split(/\s+/).length / 2.5)),
    },
  };
}

async function voiceConsistencyPass(
  runId: string,
  persona: BrandPersona,
  drafts: PlatformCopy[],
): Promise<PlatformCopy[]> {
  const system = `You are a brand-voice editor. You receive 4 drafts (LinkedIn, YouTube Short, Instagram Reel, X thread) for the same brand. Edit each ONLY for voice consistency and to eliminate forbidden words. Preserve length, format conventions, and structural rules per platform. Return strict JSON of the same shape.`;

  const prompt = `Brand: ${persona.name}
Voice attributes: ${persona.voiceAttributes.join(", ")}
Forbidden words: ${(persona.forbiddenWords ?? []).join(", ") || "(none)"}

Drafts:
${JSON.stringify(drafts, null, 2)}

Return JSON: { "copies": [ { "platform": "...", "hook": "...", "body": "...", "cta": "...", "hashtags": [...] }, ... ] }
Maintain the order: linkedin, youtube, instagram, x.`;

  try {
    const out = await llmJSON<{ copies: Array<Omit<PlatformCopy, "meta">> }>({
      tier: "smart",
      system,
      prompt,
      maxTokens: 2500,
      mockFixture: JSON.stringify({ copies: drafts }),
    });
    return out.copies.map((c) => {
      const fullText = `${c.hook}\n\n${c.body}\n\n${c.cta}`;
      return {
        ...c,
        meta: {
          characterCount: fullText.length,
          estimatedReadSeconds: Math.max(5, Math.round(fullText.split(/\s+/).length / 2.5)),
        },
      };
    });
  } catch (e) {
    console.warn("Voice consistency pass failed — using raw drafts", e);
    return drafts;
  }
}

function buildMockCopy(p: BrandPersona, s: StrategyOutput, platform: PlatformId): string {
  const isB2B = p.id === "b2b-saas-founder";

  if (platform === "linkedin") {
    return JSON.stringify(
      isB2B
        ? {
            hook: "Your activation dashboard is lying to you.",
            body: `I just pulled the cohort behavior for 14 PLG products at sub-$10k ACV.\n\nEvery one of them had an activation chart that was up and to the right.\n\nNone of them had revenue cohorts that matched.\n\nHere's the disconnect:\n\nMost teams define "activation" as sign-up + 1 meaningful click.\n\nIt feels rigorous. It inflates funnel health by 60–80%.\n\nThe number that actually predicts paid conversion is time-to-first-value under 9 minutes. Teams who hit that see ~2.3x conversion to paid.\n\nIf your dashboard says activation is "healthy" but revenue cohorts are flat — your dashboard is measuring effort, not outcome.\n\nRewrite the definition. Then rewrite the SQL.`,
            cta: "What does your activation event actually capture? Honest answers in the replies.",
            hashtags: [],
          }
        : {
            hook: "5-day splits are not the gold standard. They're the influencer standard.",
            body: `I program 3 lifting days + 2 recovery walks for most of my clients.\n\nWomen in their 30s and 40s.\nWorking jobs. Raising kids. Sleeping less than they should.\n\nHere's what that gets them — consistently, over a 12-week block:\n\n→ More volume per session (because they're not drained)\n→ Better form (because they're not panicking through reps)\n→ Higher adherence (because the calendar is honest)\n→ Better recovery (because the program respects sleep)\n\nThe 5-day split looks impressive on a phone screen.\n\nThe 3-day plan delivers progressive overload week after week. That's the only metric that matters.\n\nForm and frequency are negotiable. Progressive overload isn't.`,
            cta: "If you're on a 5-day plan and not progressing — what would happen if you took two of those days back?",
            hashtags: [],
          },
    );
  }

  if (platform === "youtube") {
    return JSON.stringify(
      isB2B
        ? {
            hook: "Your activation chart is lying to you. I can prove it in 45 seconds.",
            body: `[On camera, energetic]\nYou define activation as sign-up plus one click.\n\n[Cut to dashboard mockup]\nGreat. Now your chart is up and to the right.\n\n[Cut back]\nBut your revenue cohorts are flat.\n\n[Hold gaze]\nThat's because you measured effort, not outcome.\n\nThe number that actually predicts paid conversion is time-to-first-value under nine minutes.\n\n[Punch in]\nNine minutes. 2.3x paid conversion. The data is unambiguous.\n\nRewrite the definition. Then rewrite the SQL.\n\n[Smile]\nThen call me.`,
            cta: "Follow for more weekly numbers most founders don't run.",
            hashtags: ["#PLG", "#founders", "#analytics"],
          }
        : {
            hook: "Three lifting days. Two walks. Beats your five-day split. Here's why.",
            body: `[Walking into frame, smiling]\nYou've been told more days equals better results.\n\n[Cut to overlay: '5-day split → cortisol creep']\nThe science says under-recovered training stalls strength gains.\n\n[Back on camera]\nThree heavy lifting days lets you actually progress the bar.\n\n[Visual: rep counter ticking up week over week]\nTwo low-intensity walks recover your nervous system.\n\n[Hold]\nMore strength. Better sleep. Fewer injuries.\n\n[Wink]\nThe phone screen lied to you. The bar doesn't.`,
            cta: "Save this — try it for three weeks. Tag me when it works.",
            hashtags: ["#strengthtraining", "#womenwholift", "#sustainablefitness"],
          },
    );
  }

  if (platform === "instagram") {
    return JSON.stringify(
      isB2B
        ? {
            hook: "Three numbers most founders don't run. I'll show you mine.",
            body: `[Slide 1] Hook on screen, hold on Maya's face.\n[VO]\nMost PLG dashboards look like they're winning.\n\n[Slide 2] Revenue cohorts overlay: flat.\n[VO]\nThe activation chart is up, but the cohorts are flat.\n\n[Slide 3] Highlight: 9 minutes → 2.3x.\n[VO]\nTime-to-first-value under 9 minutes. 2.3 times paid conversion. Every time.\n\n[Slide 4] CTA card.\n[VO]\nRewrite the definition. Then rewrite the SQL.`,
            cta: "Save this and run the number tonight. If you can't, your stack is the problem.",
            hashtags: ["#plg", "#founders", "#productanalytics", "#startups", "#saas"],
          }
        : {
            hook: "Take two days back. Watch your strength go up.",
            body: `[Slide 1] Maya unracks, looks at camera.\n[VO]\nYou're doing five days a week. You're not progressing.\n\n[Slide 2] Cut to calendar overlay.\n[VO]\nDrop two. Replace with walks.\n\n[Slide 3] Maya hits a heavier set.\n[VO]\nThis is week three. Bar's heavier. Body's recovered.\n\n[Slide 4] CTA card.\n[VO]\nMore strength. Less crying. Try it.`,
            cta: "Save this for the next time you're tempted to add a sixth day.",
            hashtags: ["#strengthtraining", "#womenover30", "#progressiveoverload", "#sustainablefitness", "#liftingforlife"],
          },
    );
  }

  // X thread
  return JSON.stringify(
    isB2B
      ? {
          hook: "Your activation dashboard is lying to you. A 6-tweet teardown.",
          body: `1/ Most PLG teams define activation as sign-up + 1 meaningful click.\n\nIt feels rigorous. It inflates funnel health by 60–80%.\n\n2/ Here's the test: pull your revenue cohorts.\n\nIf activation is up and revenue cohorts are flat, you measured effort, not outcome.\n\n3/ The metric that actually predicts paid conversion:\n\nTime-to-first-value < 9 minutes.\n\nProducts that hit that bar see ~2.3x conversion to paid.\n\n4/ Why this is a definition problem, not a tooling problem:\n\nYou can install Amplitude perfectly and still measure the wrong thing.\n\nThe right SQL view is more valuable than the right SDK.\n\n5/ A fix you can ship this week:\n\nDefine "first value" as the user-visible outcome the user paid for.\n\nWrite one SQL view. Track it weekly. Watch how much your dashboard changes.\n\n6/ If your dashboard is up and to the right but your retention isn't —\n\nDelete the dashboard. Or at least, delete the definition.`,
          cta: "If this helped, the rest of our work is at lumenanalytics.com.",
          hashtags: [],
        }
      : {
          hook: "Five-day splits are an Instagram artifact, not a strength protocol. A short thread.",
          body: `1/ For working women 30–45, I program 3 lifting days + 2 walks.\n\nI've run this with ~80 clients. Adherence + progression both improve.\n\n2/ Here's what 5 days a week actually buys you:\n\n— more cortisol, less sleep\n— rushed reps, worse form\n— more "I'll catch up tomorrow" days\n\n3/ Here's what 3 lifting days buys you:\n\n— heavier sets (because you're recovered)\n— cleaner form (because you're not panicking)\n— a calendar you can actually keep\n\n4/ The only metric that compounds is progressive overload.\n\nNot frequency. Not vibes. Not before/afters.\n\n5/ Sleep <7h costs 14–22% of your lifts. Protein <1.4g/kg blunts hypertrophy ~25%.\n\nYour recovery is your most undertrained muscle.\n\nThree days. Two walks. Try it for a block.`,
          cta: "If this resonated, mayastrong.com has the full 12-week template.",
          hashtags: [],
        },
  );
}

function truncate(s: string | undefined, n = 120): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Last-resort placeholder used when an LLM copy generation fails twice.
 * Keeps the platform composition shippable so the rest of the demo still runs.
 */
function fallbackCopy(
  persona: BrandPersona,
  strategy: StrategyOutput,
  platformId: PlatformId,
): PlatformCopy {
  const hook = strategy.hero.angle;
  const body = `${strategy.hero.hypothesis}\n\n${persona.tagline}`;
  const cta = `Learn more about ${persona.name}.`;
  const fullText = `${hook}\n\n${body}\n\n${cta}`;
  return {
    platform: platformId,
    hook,
    body,
    cta,
    hashtags: [],
    meta: {
      characterCount: fullText.length,
      estimatedReadSeconds: Math.max(5, Math.round(fullText.split(/\s+/).length / 2.5)),
    },
  };
}
