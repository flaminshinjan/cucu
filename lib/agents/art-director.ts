import type {
  BRollImage,
  BrandPersona,
  ContentAssets,
  PlatformComposition,
  PlatformCopy,
  PlatformId,
  StrategyOutput,
  StudioConfig,
} from "../types";
import { PLATFORMS } from "../platforms";
import { generateVoice } from "../adapters/voice";
import { renderAvatar } from "../adapters/avatar";
import { generateImage } from "../adapters/image";
import { emit, patchAvatarOnAllCompositions } from "../store";
import { hashString } from "../utils";
import { capabilities } from "../env";

/**
 * Art Director — orchestrates voice, avatar, and thumbnail rendering, then
 * compiles per-platform compositions with timed captions.
 *
 * Two-track strategy:
 *   1. One canonical avatar/voice for the "hero script" (drives all 4 videos)
 *   2. Per-platform thumbnail + caption track tailored to aspect/format
 */
export interface ArtDirectorOutput {
  assets: ContentAssets;
  compositions: PlatformComposition[];
  /** Resolves once HeyGen (or equivalent) finishes rendering the real avatar.
   *  When no real provider is available, resolves immediately with `upgraded: false`. */
  avatarReady: Promise<{ upgraded: boolean }>;
}

export async function runArtDirector(
  runId: string,
  persona: BrandPersona,
  strategy: StrategyOutput,
  copies: PlatformCopy[],
  studio?: StudioConfig,
): Promise<ArtDirectorOutput> {
  // Single-video product: Instagram Reel only. The pipeline used to fan out
  // to 4 platforms but most prospects only see one video anyway, and 1 of each
  // (instead of 4 thumbnails + 4 compositions) keeps Replicate happy and HeyGen
  // credits low. The Reel's 9:16 aspect is the best demo format.
  const TARGET_PLATFORM: PlatformId = "instagram";
  const igCopy = copies.find((c) => c.platform === TARGET_PLATFORM) ?? copies[0];

  // Trim spoken script tight: ~10-12s of audio = ~6-8 HeyGen credits per render.
  // Full copy still lives in the captioned content side.
  const fullScriptForCaptions = stripDirectorNotes(`${igCopy.hook}\n\n${igCopy.body}\n\n${igCopy.cta}`);
  const spokenScript = condenseScript(igCopy);
  const scriptHash = hashString(spokenScript);

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "thinking",
    message: "Generating voiceover, avatar, and visuals…",
  });

  // Three b-roll beats + one thumbnail = 4 images total (down from 7).
  const bRollPrompts = buildBRollPrompts(persona, strategy, igCopy, spokenScript);
  const brandColors = { primary: persona.primaryColor, accent: persona.accentColor };
  const imageRequests = [
    {
      prompt: thumbnailPrompt(persona, strategy, TARGET_PLATFORM),
      aspectRatio: PLATFORMS[TARGET_PLATFORM].aspect,
      personaId: persona.id,
      brandColors,
    },
    ...bRollPrompts.map((p) => ({
      prompt: p.prompt,
      aspectRatio: "16:9" as const,
      personaId: persona.id,
      brandColors,
    })),
  ];

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-call",
    message: `voice.generate · image.flux ×${imageRequests.length}`,
  });

  // Replicate's free tier rate-limits aggressively. 5s gap between requests +
  // exponential-backoff retry inside the adapter (4→8→16→32s on 429) reliably
  // gets all 4 images through. Voice generation runs in parallel.
  const [voice, allImages] = await Promise.all([
    generateVoice({ text: spokenScript, gender: persona.voiceGender }),
    serialMap(imageRequests, 5000, (r) => generateImage(r)),
  ]);

  const thumb = allImages[0];
  const bRollImgs = allImages.slice(1);

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-result",
    message: `Voice ready (${voice.provider}, ${voice.durationSeconds}s) · 1 thumbnail · ${bRollImgs.length} b-roll`,
    data: {
      voiceProvider: voice.provider,
      thumbCount: 1,
      bRollCount: bRollImgs.length,
      totalImages: imageRequests.length,
    },
  });

  // The mock avatar URL — used immediately so the reveal can fire without waiting on HeyGen.
  // If no real avatar provider is configured, this is the final URL.
  const mockAvatarUrl = `client://avatar?persona=${encodeURIComponent(persona.id)}`;
  const estimatedDuration = Math.max(
    5,
    Math.round(spokenScript.trim().split(/\s+/).length / 155 * 60),
  );

  const assets: ContentAssets = {
    voiceAudioUrl: voice.url,
    avatarVideoUrl: mockAvatarUrl,
    thumbnailUrl: thumb?.url,
    scriptHash,
    avatarStatus: capabilities.hasAvatar ? "rendering" : "unavailable",
  };

  // Distribute the 3 b-roll images evenly across the duration.
  const bRoll: BRollImage[] = bRollImgs.map((img, i) => {
    const per = estimatedDuration / bRollImgs.length;
    return {
      url: img.url,
      keyword: bRollPrompts[i]?.keyword,
      startAt: +(i * per).toFixed(2),
      endAt: +((i + 1) * per).toFixed(2),
    };
  });

  // Captions track the SPOKEN (trimmed) audio.
  void fullScriptForCaptions;
  const captions = buildCaptionTrack(spokenScript, estimatedDuration);

  // Single composition (Instagram Reel)
  const compositions: PlatformComposition[] = [
    {
      platform: TARGET_PLATFORM,
      copy: igCopy,
      composedAt: Date.now(),
      sourceVideoUrl: mockAvatarUrl,
      thumbnailUrl: thumb?.url,
      bRoll,
      captions,
    },
  ];

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "result",
    message: `Instagram Reel composition ready`,
    data: { compositions: compositions.length },
  });

  // Kick the real avatar render off in the background.
  // The visible pipeline completes NOW; HeyGen renders for 3-10 min and hot-swaps when ready.
  const avatarReady = (async (): Promise<{ upgraded: boolean }> => {
    if (!capabilities.hasAvatar) {
      emit(runId, {
        ts: Date.now(),
        agent: "art-director",
        type: "tool-result",
        message: "No avatar provider configured — using brand emblem.",
        data: { kind: "avatar-status", status: "unavailable" },
      });
      return { upgraded: false };
    }
    emit(runId, {
      ts: Date.now(),
      agent: "art-director",
      type: "tool-call",
      message: "avatar.render · running in background",
      data: { kind: "avatar-status", status: "rendering" },
    });
    try {
      const avatar = await renderAvatar({
        script: spokenScript,
        voiceAudioUrl: voice.url,
        personaId: persona.id,
        gender: persona.voiceGender,
        studio: studio
          ? {
              talkingPhotoId: studio.talkingPhotoId,
              voiceId: studio.voiceId,
              avatarId: studio.avatarId,
            }
          : undefined,
        onProgress: (p) => {
          if (p.elapsedSeconds === 0 || p.elapsedSeconds % 15 === 0) {
            emit(runId, {
              ts: Date.now(),
              agent: "art-director",
              type: "thinking",
              message: `Avatar render · ${p.status} · ${p.elapsedSeconds}s elapsed`,
              data: { kind: "avatar-status", status: "rendering", elapsedSeconds: p.elapsedSeconds },
            });
          }
        },
      });
      if (avatar.provider !== "mock") {
        patchAvatarOnAllCompositions(runId, avatar.videoUrl);
        emit(runId, {
          ts: Date.now(),
          agent: "art-director",
          type: "result",
          message: `Avatar upgraded — ${avatar.provider} render swapped in`,
          data: {
            kind: "avatar-upgraded",
            videoUrl: avatar.videoUrl,
            provider: avatar.provider,
            durationSeconds: avatar.durationSeconds,
            status: "ready",
          },
        });
        return { upgraded: true };
      }
      return { upgraded: false };
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : String(e);
      // Distinguish "no credit" from other errors so the UI can show a clear nudge.
      const isCredit = /insufficient credit|insufficient_credit|insufficient funds|credit/i.test(
        rawMessage,
      );
      // Use tool-result (not error) so this background failure doesn't
      // mark the whole run as errored — the run already finished its visible work.
      emit(runId, {
        ts: Date.now(),
        agent: "art-director",
        type: "tool-result",
        message: isCredit
          ? `HeyGen API credits required — using brand emblem instead.`
          : `Avatar provider failed (${truncateMsg(rawMessage)}). Using brand emblem.`,
        data: {
          kind: "avatar-status",
          status: "failed",
          reason: rawMessage,
          isCredit,
        },
      });
      return { upgraded: false };
    }
  })();

  return { assets, compositions, avatarReady };
}

function thumbnailPrompt(p: BrandPersona, s: StrategyOutput, platform: string): string {
  return `Bold, editorial thumbnail for a ${platform} post titled: "${s.hero.angle}". Brand: ${p.name}. Style: high-contrast, single subject, large negative space, no text. Mood matches: ${p.voiceAttributes.slice(0, 2).join(", ")}.`;
}

/**
 * Cheap deterministic caption builder — splits script into clauses and
 * distributes them evenly across the duration. Good enough for the demo's
 * burned-in caption track; swap to forced-alignment (e.g. Whisper) post-MVP.
 */
function buildCaptionTrack(script: string, durationSeconds: number) {
  const clauses = script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (clauses.length === 0) return [];
  const per = durationSeconds / clauses.length;
  return clauses.map((text, i) => ({
    start: +(i * per).toFixed(2),
    end: +((i + 1) * per).toFixed(2),
    text,
  }));
}

/** Remove bracketed stage directions like "[Cut to dashboard]" before TTS */
function stripDirectorNotes(s: string): string {
  return s.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Build 3 contextual b-roll prompts — purely visual archetypes.
 *
 * We DO NOT pass any sentence from the script into Flux: it treats sentences
 * as text and bakes garbled words into the image. Instead we map the persona
 * industry to a visual archetype and ask for pure photography with an
 * aggressive "no text" guardrail.
 */
function buildBRollPrompts(
  persona: BrandPersona,
  _strategy: StrategyOutput,
  _ytCopy: PlatformCopy,
  _spokenScript: string,
): Array<{ keyword: string; prompt: string }> {
  // First clause of `industry` ("Fintech — Payments" → "Fintech")
  const sector = persona.industry.split(/[—\-:]/)[0]?.trim() || persona.industry;

  // Hard guardrail — text/typography are the things Flux gets wrong here.
  const NO_TEXT =
    "ABSOLUTELY NO text, NO words, NO letters, NO typography, NO captions, NO logos, NO writing of any kind anywhere in the image.";

  // Strong style anchor — editorial photography aesthetic, brand-color accents only.
  const STYLE = `Editorial photograph, cinematic, soft natural window light, shallow depth of field, muted tones with ${persona.primaryColor} and ${persona.accentColor} as subtle accents. Photoreal, not illustrated.`;

  // Three beats — purely visual archetypes, no script content.
  return [
    {
      keyword: "Hook",
      prompt: `Wide establishing shot of a modern ${sector.toLowerCase()} workspace, hands and laptop on a clean desk, mid-morning light through a tall window. Subject is mid-task, not facing camera. ${STYLE} ${NO_TEXT}`,
    },
    {
      keyword: "Build",
      prompt: `Close-up macro shot of a single object representing ${sector.toLowerCase()} — a phone screen with abstract bars, a notebook with sketches, or a steaming coffee on a wooden desk. Out-of-focus background. ${STYLE} ${NO_TEXT}`,
    },
    {
      keyword: "Payoff",
      prompt: `Aspirational over-the-shoulder shot of a person looking out a sunlit window in a modern ${sector.toLowerCase()} setting. Calm, focused, late-afternoon golden light. Not facing camera. ${STYLE} ${NO_TEXT}`,
    },
  ];
}

/** Run `fn` over `items` with at most `concurrency` in flight at a time. */
async function batchedMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await Promise.all(workers);
  return results;
}

function truncateMsg(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Condense the YouTube Shorts copy into a tight ~12s avatar read.
 *  - Hook (always)
 *  - First sentence of body (the lede)
 *  - CTA (always)
 * Capped at ~280 characters total so HeyGen credit cost stays predictable
 * (~6-8 credits per render at ~0.7 credits/sec).
 */
function condenseScript(yt: PlatformCopy): string {
  const hook = stripDirectorNotes(yt.hook).trim();
  const bodyClean = stripDirectorNotes(yt.body).trim();
  const lede = bodyClean.split(/(?<=[.!?])\s+/)[0] ?? "";
  const cta = stripDirectorNotes(yt.cta).trim();

  const parts = [hook, lede, cta].filter(Boolean);
  let joined = parts.join(" ");
  if (joined.length > 280) {
    // If still too long, prefer hook + cta only
    joined = [hook, cta].filter(Boolean).join(" ");
  }
  if (joined.length > 280) {
    joined = joined.slice(0, 277).trim() + "…";
  }
  return joined;
}

/** Run `fn` over `items` one at a time, with `delayMs` between requests after the first. */
async function serialMap<T, R>(
  items: T[],
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
    out.push(await fn(items[i], i));
  }
  return out;
}
