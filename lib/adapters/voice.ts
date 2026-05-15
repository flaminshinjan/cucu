import { env, capabilities } from "../env";
import { storage } from "./storage";
import { hashString } from "../utils";
import type { VoiceGender } from "../types";

export interface VoiceRequest {
  text: string;
  voiceId?: string;
  gender?: VoiceGender;
}

export interface VoiceResult {
  url: string;
  durationSeconds: number;
  cached: boolean;
  provider: "openai" | "browser" | "mock";
}

/** Map persona gender → OpenAI TTS voice id.
 *  Defaults are picked for clarity and warmth; users can override via OPENAI_TTS_VOICE. */
function openAiVoiceForGender(g: VoiceGender | undefined): string {
  switch (g) {
    case "female":
      return "nova";
    case "male":
      return "onyx";
    default:
      return "alloy";
  }
}

/**
 * Server-side TTS via OpenAI tts-1 (smallest viable model).
 * When unavailable, returns a "browser" provider hint so the client
 * falls back to window.speechSynthesis — still produces audio with no key.
 */
export async function generateVoice(req: VoiceRequest): Promise<VoiceResult> {
  // Resolve voice: explicit override > env override > gender-aware default.
  // The env var only counts if the user explicitly set it (not blank).
  const resolvedVoice =
    req.voiceId ||
    (env.ttsVoice && env.ttsVoice !== "alloy" ? env.ttsVoice : openAiVoiceForGender(req.gender));

  // Include voice in cache key so swapping gender produces a fresh audio file.
  const cacheKey = `voice/${hashString(req.text + resolvedVoice)}.mp3`;
  const cached = await storage.get(cacheKey);
  if (cached) {
    return {
      url: cached,
      durationSeconds: estimateSpokenSeconds(req.text),
      cached: true,
      provider: "openai",
    };
  }

  if (!capabilities.hasTTS) {
    // Client uses SpeechSynthesis based on this marker
    return {
      url: `client://speech?text=${encodeURIComponent(req.text)}&gender=${req.gender ?? "neutral"}`,
      durationSeconds: estimateSpokenSeconds(req.text),
      cached: false,
      provider: "browser",
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.ttsModel,
        voice: resolvedVoice,
        input: req.text,
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const url = await storage.put(cacheKey, buf, "audio/mpeg");
    return {
      url,
      durationSeconds: estimateSpokenSeconds(req.text),
      cached: false,
      provider: "openai",
    };
  } catch (e) {
    console.warn("OpenAI TTS failed, falling back to browser SpeechSynthesis", e);
    return {
      url: `client://speech?text=${encodeURIComponent(req.text)}`,
      durationSeconds: estimateSpokenSeconds(req.text),
      cached: false,
      provider: "browser",
    };
  }
}

export function estimateSpokenSeconds(text: string): number {
  const words = text.trim().split(/\s+/).length;
  // ~155 wpm average reading + breath pauses
  return Math.max(3, Math.round((words / 155) * 60));
}
