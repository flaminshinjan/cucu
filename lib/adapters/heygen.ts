import { env } from "../env";

export interface TalkingPhotoResult {
  talkingPhotoId: string;
  talkingPhotoUrl?: string;
}

export interface AudioAssetResult {
  audioAssetId: string;
  audioUrl?: string;
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
 * Upload an audio file as a HeyGen asset and return its asset id.
 * Used to attach an externally-synthesized track (Replicate XTTS-v2 in cucu's
 * case) as the voice in a HeyGen render via `voice: { type: "audio", audio_asset_id }`.
 *
 * HeyGen's public API has no instant-voice-clone endpoint, so cucu generates
 * speech in the user's cloned voice via Replicate XTTS-v2 and hands the result
 * to HeyGen as raw audio for lipsync.
 */
export async function uploadAudioAsset(
  bytes: Buffer,
  contentType: string,
): Promise<AudioAssetResult> {
  if (!env.heygenKey) {
    throw new Error("HeyGen API key not set");
  }
  const res = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "x-api-key": env.heygenKey,
      "content-type": contentType || "audio/mpeg",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HeyGen audio asset upload ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { id?: string; url?: string } };
  const id = json.data?.id;
  if (!id) {
    throw new Error(`HeyGen asset upload returned no id: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { audioAssetId: id, audioUrl: json.data?.url };
}
