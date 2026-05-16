import { env, capabilities } from "../env";
import { storage } from "./storage";
import { hashString } from "../utils";
import type { VoiceGender } from "../types";

export interface AvatarRequest {
  script: string;
  voiceAudioUrl?: string;
  /** Brand persona hint for picking an avatar */
  personaId?: string;
  /** Selects an avatar of the matching gender, and a matching voice. */
  gender?: VoiceGender;
  /** Studio overrides — uploaded by the user via the Studio sheet.
   *  When present, these win over the auto-discovered HeyGen defaults. */
  studio?: {
    talkingPhotoId?: string;
    voiceId?: string;
    avatarId?: string;
  };
  /** Called once per poll tick so the UI can show heartbeat progress */
  onProgress?: (info: { elapsedSeconds: number; status: string }) => void;
}

export interface AvatarResult {
  /** Either a real video URL (HeyGen/D-ID) or a client://avatar marker for the CSS avatar */
  videoUrl: string;
  cached: boolean;
  provider: "heygen" | "did" | "mock";
  durationSeconds: number;
}

/**
 * Avatar render. Defaults to a high-quality CSS/Canvas mock avatar driven by
 * the audio track on the client. When HeyGen or D-ID keys are present we hit
 * the real API and store the resulting MP4.
 */
export async function renderAvatar(req: AvatarRequest): Promise<AvatarResult> {
  // Cache key includes the studio overrides so a swap of face/voice doesn't hit a stale mp4.
  const studioKey = `${req.studio?.talkingPhotoId ?? ""}|${req.studio?.voiceId ?? ""}|${req.studio?.avatarId ?? ""}`;
  const cacheKey = `avatar/${hashString(req.script + (req.personaId ?? "") + (req.gender ?? "") + studioKey)}.mp4`;
  const cached = await storage.get(cacheKey);
  const durationSeconds = estimateDuration(req.script);

  if (cached) {
    return { videoUrl: cached, cached: true, provider: env.avatarProvider as "heygen" | "did", durationSeconds };
  }

  if (!capabilities.hasAvatar) {
    return {
      // Client renders an animated SVG/Canvas avatar lipsyncing to the audio
      videoUrl: `client://avatar?persona=${encodeURIComponent(req.personaId ?? "default")}`,
      cached: false,
      provider: "mock",
      durationSeconds,
    };
  }

  try {
    if (env.avatarProvider === "heygen") {
      return await heygenRender(req, cacheKey, durationSeconds);
    }
    if (env.avatarProvider === "did") {
      return await didRender(req, cacheKey, durationSeconds);
    }
  } catch (e) {
    console.warn("Avatar render failed, falling back to mock", e);
  }

  return {
    videoUrl: `client://avatar?persona=${encodeURIComponent(req.personaId ?? "default")}`,
    cached: false,
    provider: "mock",
    durationSeconds,
  };
}

/** Cache discovered HeyGen defaults per gender so we don't re-query each render. */
const _heygenDefaultsByGender: Map<string, { avatarId: string; voiceId: string }> = new Map();

/** Mutable holder for log throttling (per-run scoping isn't needed for diagnostics) */
const heygenLogBucket: { _b?: number; _s?: string } = {};

async function getHeygenDefaults(
  inputGender: VoiceGender = "female",
): Promise<{ avatarId: string; voiceId: string }> {
  // Explicit env overrides always win.
  if (env.heygenAvatarId && env.heygenVoiceId) {
    return { avatarId: env.heygenAvatarId, voiceId: env.heygenVoiceId };
  }

  // Defensive: "neutral" silently picks male in HeyGen's voice ordering, which
  // pairs poorly with the female-by-luck avatar. Normalize to female.
  const gender: VoiceGender = inputGender === "neutral" ? "female" : inputGender;

  const cached = _heygenDefaultsByGender.get(gender);
  if (cached) return cached;

  const headers = { "x-api-key": env.heygenKey };
  const [aRes, vRes] = await Promise.all([
    fetch("https://api.heygen.com/v2/avatars", { headers }),
    fetch("https://api.heygen.com/v2/voices", { headers }),
  ]);
  if (!aRes.ok) throw new Error(`HeyGen list avatars ${aRes.status}`);
  if (!vRes.ok) throw new Error(`HeyGen list voices ${vRes.status}`);

  const aJson = (await aRes.json()) as {
    data?: {
      avatars?: Array<{ avatar_id: string; gender?: string; premium?: boolean }>;
    };
  };
  const vJson = (await vRes.json()) as {
    data?: {
      voices?: Array<{ voice_id: string; language?: string; gender?: string }>;
    };
  };

  const allAvatars = aJson.data?.avatars ?? [];
  const allVoices = vJson.data?.voices ?? [];

  // Filter avatars: strict gender match + prefer free tier
  const avatarsOfGender = allAvatars.filter(
    (a) => (a.gender ?? "").toLowerCase() === gender,
  );
  const freeAvatars = avatarsOfGender.filter((a) => a.premium === false);

  // Filter voices: strict gender match + English when available
  const isEnglish = (v: { language?: string }) =>
    v.language?.toLowerCase().includes("english") ||
    v.language?.toLowerCase().includes("en");
  const matchesGender = (v: { gender?: string }) =>
    (v.gender ?? "").toLowerCase() === gender;

  const englishGenderVoices = allVoices.filter((v) => isEnglish(v) && matchesGender(v));
  const anyGenderVoices = allVoices.filter(matchesGender);
  const englishVoices = allVoices.filter(isEnglish);

  const avatarId =
    env.heygenAvatarId ||
    freeAvatars[0]?.avatar_id ||
    avatarsOfGender[0]?.avatar_id ||
    allAvatars[0]?.avatar_id ||
    "";

  const voiceId =
    env.heygenVoiceId ||
    englishGenderVoices[0]?.voice_id ||
    anyGenderVoices[0]?.voice_id ||
    englishVoices[0]?.voice_id ||
    allVoices[0]?.voice_id ||
    "";

  if (!avatarId || !voiceId) {
    throw new Error(`HeyGen: no avatar/voice for gender=${gender} on this account`);
  }

  const picked = { avatarId, voiceId };
  _heygenDefaultsByGender.set(gender, picked);
  console.log(`[heygen] picked for gender=${gender} → avatar=${avatarId}  voice=${voiceId}`);
  return picked;
}

async function heygenRender(
  req: AvatarRequest,
  cacheKey: string,
  durationSeconds: number,
): Promise<AvatarResult> {
  // HeyGen returns "Insufficient credit. This operation requires 'api' credits."
  // as a generic rejection when their burst rate-limit fires, NOT only when
  // credits are actually low. Symptom: failure within ~30s of submit even though
  // the account has hundreds of credits. We treat that as a transient throttle:
  // wait 60s, try once more. After that, fall back to the brand emblem.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await heygenRenderOnce(req, cacheKey, durationSeconds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isCreditOrBurst = /insufficient credit|insufficient_credit/i.test(msg);
      if (isCreditOrBurst && attempt === 1) {
        console.log(`[heygen] caught burst-throttle; backing off 60s before retry`);
        req.onProgress?.({
          elapsedSeconds: 0,
          status: "throttled — retrying in 60s",
        });
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }
      throw e;
    }
  }
  throw new Error("HeyGen render failed after burst-throttle retry");
}

async function heygenRenderOnce(
  req: AvatarRequest,
  cacheKey: string,
  durationSeconds: number,
): Promise<AvatarResult> {
  const defaults = await getHeygenDefaults(req.gender);

  // Studio overrides win over discovered defaults
  const talkingPhotoId = req.studio?.talkingPhotoId;
  const avatarId = req.studio?.avatarId ?? defaults.avatarId;
  const voiceId = req.studio?.voiceId ?? defaults.voiceId;

  // If the user uploaded their face (talking_photo), use it as the character.
  // Otherwise fall back to a regular avatar id.
  const character = talkingPhotoId
    ? { type: "talking_photo" as const, talking_photo_id: talkingPhotoId }
    : { type: "avatar" as const, avatar_id: avatarId, avatar_style: "normal" };

  // HeyGen v2: create video → poll status → download URL
  const create = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: {
      "x-api-key": env.heygenKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character,
          voice: { type: "text", input_text: req.script, voice_id: voiceId },
        },
      ],
      dimension: { width: 720, height: 1280 },
    }),
  });
  if (!create.ok) {
    const body = await create.text().catch(() => "");
    throw new Error(`HeyGen create ${create.status}: ${body.slice(0, 200)}`);
  }
  const created = (await create.json()) as { data: { video_id: string } };
  const videoId = created.data.video_id;
  console.log(
    `[heygen] video submitted: ${videoId}  character=${talkingPhotoId ? `talking_photo:${talkingPhotoId}` : `avatar:${avatarId}`}  voice=${voiceId}`,
  );
  req.onProgress?.({ elapsedSeconds: 0, status: `submitted (video_id: ${videoId})` });

  // Poll up to ~20 minutes. Free-tier HeyGen queues + renders ~1-2s of video/sec
  // so a 55-second YouTube Short script ends up around 8-15 min end-to-end.
  const POLL_INTERVAL_MS = 5000;
  const MAX_POLLS = 240;
  const start = Date.now();

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { "x-api-key": env.heygenKey },
    });
    const sj = (await status.json()) as {
      data: { status: string; video_url?: string; error?: { message?: string } };
    };
    const elapsed = Math.round((Date.now() - start) / 1000);
    // Log status transitions and once per 30s bucket
    const bucket = Math.floor(elapsed / 30);
    if (i === 0 || bucket !== (heygenLogBucket._b ?? -1) || sj.data.status !== (heygenLogBucket._s ?? "")) {
      console.log(`[heygen] poll t+${elapsed}s  status=${sj.data.status}  err=${sj.data.error?.message ?? ""}`);
      heygenLogBucket._b = bucket;
      heygenLogBucket._s = sj.data.status;
    }
    req.onProgress?.({ elapsedSeconds: elapsed, status: sj.data.status });

    if (sj.data.status === "completed" && sj.data.video_url) {
      const mp4 = Buffer.from(await (await fetch(sj.data.video_url)).arrayBuffer());
      const url = await storage.put(cacheKey, mp4, "video/mp4");
      return { videoUrl: url, cached: false, provider: "heygen", durationSeconds };
    }
    if (sj.data.status === "failed") {
      throw new Error(`HeyGen render failed: ${sj.data.error?.message ?? "unknown"}`);
    }
  }
  throw new Error("HeyGen render timed out after 20 minutes");
}

async function didRender(
  req: AvatarRequest,
  cacheKey: string,
  durationSeconds: number,
): Promise<AvatarResult> {
  // Pick a gender-appropriate presenter source + Azure TTS voice.
  // User can override by uploading their own face via Studio (overrides source_url).
  const sourceUrl =
    req.studio?.talkingPhotoId && req.studio.talkingPhotoId.startsWith("http")
      ? req.studio.talkingPhotoId
      : pickDidSourceImage(req.gender);
  const voiceConfig = pickDidVoice(req.gender);

  const create = await fetch("https://api.d-id.com/talks", {
    method: "POST",
    headers: {
      Authorization: `Basic ${env.didKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      script: {
        type: "text",
        input: req.script,
        provider: voiceConfig,
      },
      source_url: sourceUrl,
      config: {
        fluent: true,
        pad_audio: 0.0,
        stitch: true,
      },
    }),
  });
  if (!create.ok) {
    const body = await create.text().catch(() => "");
    throw new Error(`D-ID create ${create.status}: ${body.slice(0, 200)}`);
  }
  const created = (await create.json()) as {
    id?: string;
    error?: { description?: string; kind?: string };
  };
  if (!created.id) {
    throw new Error(
      `D-ID returned no talk id: ${created.error?.description ?? JSON.stringify(created).slice(0, 200)}`,
    );
  }
  const talkId = created.id;
  console.log(`[did] talk submitted: ${talkId}  source=${sourceUrl.slice(0, 60)}  voice=${voiceConfig.voice_id}`);
  req.onProgress?.({ elapsedSeconds: 0, status: `submitted (talk_id: ${talkId})` });

  // Poll up to 5 minutes — D-ID is typically <60s for talks under 30s of audio.
  const POLL_INTERVAL_MS = 4000;
  const MAX_POLLS = 75;
  const start = Date.now();
  let lastLoggedBucket = -1;
  let lastLoggedStatus = "";

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      headers: { Authorization: `Basic ${env.didKey}` },
    });
    const sj = (await status.json()) as {
      status?: string;
      result_url?: string;
      error?: { description?: string; kind?: string };
    };
    const elapsed = Math.round((Date.now() - start) / 1000);
    const bucket = Math.floor(elapsed / 20);
    if (i === 0 || bucket !== lastLoggedBucket || sj.status !== lastLoggedStatus) {
      console.log(
        `[did] poll t+${elapsed}s  status=${sj.status}  err=${sj.error?.description ?? ""}`,
      );
      lastLoggedBucket = bucket;
      lastLoggedStatus = sj.status ?? "";
    }
    req.onProgress?.({ elapsedSeconds: elapsed, status: sj.status ?? "?" });

    if (sj.status === "done" && sj.result_url) {
      const mp4 = Buffer.from(await (await fetch(sj.result_url)).arrayBuffer());
      const url = await storage.put(cacheKey, mp4, "video/mp4");
      return { videoUrl: url, cached: false, provider: "did", durationSeconds };
    }
    if (sj.status === "error" || sj.status === "rejected") {
      throw new Error(`D-ID failed: ${sj.error?.description ?? sj.error?.kind ?? "unknown"}`);
    }
  }
  throw new Error("D-ID render timed out after 5 minutes");
}

/** D-ID public sample portraits — both ship with the free tier. */
function pickDidSourceImage(gender?: VoiceGender): string {
  // 'Alice' — D-ID's documented female sample, known to work on free tier
  const female = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg";
  // 'Noelle' style — using the same public bucket pattern
  const male = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/v3/noelle.jpeg";
  if (gender === "male") return male;
  return female;
}

/** Microsoft Azure TTS voices — D-ID's most reliable provider. */
function pickDidVoice(gender?: VoiceGender): { type: "microsoft"; voice_id: string } {
  if (gender === "male") {
    return { type: "microsoft", voice_id: "en-US-GuyNeural" };
  }
  // Warm, conversational, professional — default for cucu
  return { type: "microsoft", voice_id: "en-US-JennyNeural" };
}

function estimateDuration(script: string): number {
  const words = script.trim().split(/\s+/).length;
  return Math.max(5, Math.round((words / 155) * 60));
}
