import type {
  BrandPersona,
  ContentAssets,
  PlatformComposition,
  PlatformCopy,
  StrategyOutput,
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

  // Parallel: voice + thumbnails. Avatar waits on voice (which is the cheap path).
  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-call",
    message: "voice.generate · image.flux ×4",
  });

  const [voice, ...thumbs] = await Promise.all([
    generateVoice({ text: spokenScript, gender: persona.voiceGender }),
    ...PLATFORM_ORDER.map((id) =>
      generateImage({
        prompt: thumbnailPrompt(persona, strategy, id),
        aspectRatio: PLATFORMS[id].aspect,
        personaId: persona.id,
      }),
    ),
  ]);

  emit(runId, {
    ts: Date.now(),
    agent: "art-director",
    type: "tool-result",
    message: `Voice ready (${voice.provider}, ${voice.durationSeconds}s) · ${thumbs.length} thumbnails`,
    data: { voiceProvider: voice.provider, thumbCount: thumbs.length },
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

  // Build per-platform compositions with timed captions
  const compositions: PlatformComposition[] = PLATFORM_ORDER.map((id, i) => ({
    platform: id,
    copy: copies.find((c) => c.platform === id)!,
    composedAt: Date.now(),
    sourceVideoUrl: mockAvatarUrl,
    thumbnailUrl: thumbs[i]?.url,
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
