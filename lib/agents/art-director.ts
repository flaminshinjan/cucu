import type {
  BRollImage,
  BrandPersona,
  ContentAssets,
  PlatformComposition,
  PlatformCopy,
  StrategyOutput,
  StudioConfig,
} from "../types";
import { PLATFORMS, PLATFORM_ORDER } from "../platforms";
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
  // The single canonical script that drives the avatar/voiceover.
  // We use the YouTube Shorts copy as the spoken script — it's already structured for that pace.
  const ytCopy = copies.find((c) => c.platform === "youtube") ?? copies[0];
  const spokenScript = stripDirectorNotes(`${ytCopy.hook}\n\n${ytCopy.body}\n\n${ytCopy.cta}`);
  const scriptHash = hashString(spokenScript);

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "thinking",
    message: "Generating voiceover, avatar, and thumbnails…",
  });

  // Three b-roll beats — derived from the spoken script (hook / build / payoff).
  const bRollPrompts = buildBRollPrompts(persona, strategy, ytCopy, spokenScript);

  // Parallel: voice + per-platform thumbnails + 3 b-roll images for the content half.
  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-call",
    message: `voice.generate · image.flux ×${PLATFORM_ORDER.length + bRollPrompts.length}`,
  });

  const totalImages = PLATFORM_ORDER.length + bRollPrompts.length;
  const allImagesAndVoice = await Promise.all([
    generateVoice({ text: spokenScript, gender: persona.voiceGender }),
    // 4 platform thumbnails (one per platform aspect)
    ...PLATFORM_ORDER.map((id) =>
      generateImage({
        prompt: thumbnailPrompt(persona, strategy, id),
        aspectRatio: PLATFORMS[id].aspect,
        personaId: persona.id,
      }),
    ),
    // 3 contextual b-roll images at 16:9 (content half is widescreen-ish on most layouts)
    ...bRollPrompts.map((p) =>
      generateImage({
        prompt: p.prompt,
        aspectRatio: "16:9",
        personaId: persona.id,
      }),
    ),
  ]);

  const voice = allImagesAndVoice[0] as Awaited<ReturnType<typeof generateVoice>>;
  const thumbs = allImagesAndVoice.slice(1, 1 + PLATFORM_ORDER.length) as Array<
    Awaited<ReturnType<typeof generateImage>>
  >;
  const bRollImgs = allImagesAndVoice.slice(1 + PLATFORM_ORDER.length) as Array<
    Awaited<ReturnType<typeof generateImage>>
  >;

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-result",
    message: `Voice ready (${voice.provider}, ${voice.durationSeconds}s) · ${thumbs.length} thumbnails · ${bRollImgs.length} b-roll`,
    data: {
      voiceProvider: voice.provider,
      thumbCount: thumbs.length,
      bRollCount: bRollImgs.length,
      totalImages,
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
    thumbnailUrl: thumbs[0]?.url,
    scriptHash,
  };

  // Distribute the 3 b-roll images evenly across the duration with small overlap.
  const bRoll: BRollImage[] = bRollImgs.map((img, i) => {
    const per = estimatedDuration / bRollImgs.length;
    return {
      url: img.url,
      keyword: bRollPrompts[i]?.keyword,
      startAt: +(i * per).toFixed(2),
      endAt: +((i + 1) * per).toFixed(2),
    };
  });

  // Build per-platform compositions with timed captions + shared b-roll
  const compositions: PlatformComposition[] = PLATFORM_ORDER.map((id, i) => ({
    platform: id,
    copy: copies.find((c) => c.platform === id)!,
    composedAt: Date.now(),
    sourceVideoUrl: mockAvatarUrl,
    thumbnailUrl: thumbs[i]?.url,
    bRoll,
    captions: buildCaptionTrack(spokenScript, estimatedDuration),
  }));

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "result",
    message: `Compositions ready for ${compositions.length} platforms`,
    data: { compositions: compositions.length },
  });

  // Kick the real avatar render off in the background.
  // The visible pipeline completes NOW; HeyGen renders for 3-10 min and hot-swaps when ready.
  const avatarReady = (async (): Promise<{ upgraded: boolean }> => {
    if (!capabilities.hasAvatar) {
      return { upgraded: false };
    }
    emit(runId, {
      ts: Date.now(),
      agent: "art-director",
      type: "tool-call",
      message: "avatar.render · running in background",
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
          },
        });
        return { upgraded: true };
      }
      return { upgraded: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      emit(runId, {
        ts: Date.now(),
        agent: "art-director",
        type: "thinking",
        message: `Avatar provider failed (${message}). Keeping mock avatar.`,
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
 * Build 3 contextual b-roll prompts (hook / build / payoff) from the script.
 * Each prompt is brand-aware and uses Flux Schnell-friendly phrasing.
 */
function buildBRollPrompts(
  persona: BrandPersona,
  strategy: StrategyOutput,
  ytCopy: PlatformCopy,
  spokenScript: string,
): Array<{ keyword: string; prompt: string }> {
  const styleSuffix = `Editorial photograph, soft natural light, high contrast, shallow depth of field, ${persona.primaryColor} and ${persona.accentColor} brand palette as subtle color accents. No text. No people staring at camera.`;
  const sentences = spokenScript.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);
  const hook = sentences[0] ?? ytCopy.hook;
  const middle = sentences[Math.floor(sentences.length / 2)] ?? ytCopy.body.slice(0, 120);
  const payoff = sentences[sentences.length - 1] ?? ytCopy.cta;
  return [
    {
      keyword: "Hook",
      prompt: `Cinematic open establishing the topic: ${hook}. Industry: ${persona.industry}. ${styleSuffix}`,
    },
    {
      keyword: "Build",
      prompt: `Mid-arc tension beat illustrating: ${middle}. Industry: ${persona.industry}. ${styleSuffix}`,
    },
    {
      keyword: "Payoff",
      prompt: `Triumphant closing visual for: ${payoff}. Industry: ${persona.industry}. ${styleSuffix}`,
    },
  ];
}
