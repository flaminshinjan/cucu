import { env } from "../env";

export interface TalkingPhotoResult {
  talkingPhotoId: string;
  talkingPhotoUrl?: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  name: string;
}

/**
 * Upload a user face image to HeyGen as a "Talking Photo".
 * Returns a talking_photo_id usable as `character.type=talking_photo` when rendering.
 *
 * Endpoint: POST https://upload.heygen.com/v1/talking_photo
 * Auth:     x-api-key header
 * Body:     raw image bytes; Content-Type matches the image (image/jpeg | image/png)
 */
export async function uploadTalkingPhoto(
  bytes: Buffer,
  contentType: string,
): Promise<TalkingPhotoResult> {
  if (!env.heygenKey) {
    throw new Error("HeyGen API key not set");
  }
  const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
    method: "POST",
    headers: {
      "x-api-key": env.heygenKey,
      "content-type": contentType,
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HeyGen talking_photo upload ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    code?: number;
    data?: { talking_photo_id?: string; talking_photo_url?: string };
    message?: string;
  };
  const id = json.data?.talking_photo_id;
  if (!id) {
    throw new Error(`HeyGen returned no talking_photo_id: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { talkingPhotoId: id, talkingPhotoUrl: json.data?.talking_photo_url };
}

/**
 * Clone a user's voice from an audio sample via HeyGen Instant Voice Clone.
 * Requires a Pro+ plan on most HeyGen accounts; falls back with a clear error
 * if the plan doesn't include voice cloning.
 *
 * Two-step flow:
 *  1. POST /v1/asset to upload the audio file → returns asset URL
 *  2. POST /v1/voice/voice_clone/create with that URL → returns voice_id
 */
export async function cloneVoice(
  bytes: Buffer,
  contentType: string,
  name: string,
): Promise<VoiceCloneResult> {
  if (!env.heygenKey) {
    throw new Error("HeyGen API key not set");
  }

  // Step 1 — upload the audio asset
  const assetRes = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "x-api-key": env.heygenKey,
      "content-type": contentType,
    },
    body: new Uint8Array(bytes),
  });
  if (!assetRes.ok) {
    const body = await assetRes.text().catch(() => "");
    throw new Error(`HeyGen asset upload ${assetRes.status}: ${body.slice(0, 200)}`);
  }
  const assetJson = (await assetRes.json()) as {
    data?: { id?: string; url?: string };
  };
  const audioUrl = assetJson.data?.url;
  if (!audioUrl) {
    throw new Error(`HeyGen asset upload returned no url: ${JSON.stringify(assetJson).slice(0, 200)}`);
  }

  // Step 2 — create a voice clone from it
  const cloneRes = await fetch("https://api.heygen.com/v1/voice/voice_clone/create", {
    method: "POST",
    headers: {
      "x-api-key": env.heygenKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      audio_url: audioUrl,
    }),
  });
  if (!cloneRes.ok) {
    const body = await cloneRes.text().catch(() => "");
    // Common case: free plan — surface a useful error
    if (cloneRes.status === 403 || cloneRes.status === 402) {
      throw new Error(
        `HeyGen voice cloning isn't available on this plan (HTTP ${cloneRes.status}). Upgrade or use a library voice.`,
      );
    }
    throw new Error(`HeyGen voice clone ${cloneRes.status}: ${body.slice(0, 200)}`);
  }
  const cloneJson = (await cloneRes.json()) as {
    data?: { voice_id?: string };
  };
  const voiceId = cloneJson.data?.voice_id;
  if (!voiceId) {
    throw new Error(`HeyGen voice clone returned no voice_id: ${JSON.stringify(cloneJson).slice(0, 200)}`);
  }
  return { voiceId, name };
}
