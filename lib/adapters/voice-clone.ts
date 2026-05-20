import { env } from "../env";

/**
 * Zero-shot voice cloning via Coqui XTTS-v2 on Replicate.
 *
 * No "create voice" step: the speaker sample audio is passed alongside the text
 * on every TTS call. cucu stashes the user-uploaded sample in storage at signup
 * time, then sends it (as a data URI) plus the script here at render time.
 *
 * Model: lucataco/xtts-v2
 * Inputs:
 *  - text: the script to speak
 *  - speaker: URL or data URI for the speaker audio (>= 6s recommended)
 *  - language: "en" | "es" | "fr" | "de" | "it" | "pt" | "pl" | "tr" | "ru"
 *              | "nl" | "cs" | "ar" | "zh" | "hu" | "ko" | "hi"
 *  - cleanup_voice: denoise mic recordings (default false — true for raw uploads)
 * Output: a WAV file URL.
 */
export async function synthesizeWithSample(
  text: string,
  speakerBytes: Buffer,
  speakerContentType: string,
  opts: { language?: string; cleanupVoice?: boolean } = {},
): Promise<{ bytes: Buffer; contentType: "audio/x-wav" }> {
  if (!env.replicateToken) {
    throw new Error("Replicate API token not set");
  }

  // Replicate accepts data: URIs for Path inputs. Voice samples are small
  // (typically <5 MB), so inlining is simpler than hosting an upload endpoint.
  const speakerDataUri = `data:${speakerContentType || "audio/mpeg"};base64,${speakerBytes.toString("base64")}`;

  // lucataco/xtts-v2 is a community model, so the model-name shortcut endpoint
  // (used by Flux Schnell elsewhere) 404s. Community models require
  // POST /v1/predictions with an explicit version hash.
  const version = await getXttsLatestVersion();

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.replicateToken}`,
      "content-type": "application/json",
      // Wait up to 60s for the sync result; we poll if it falls back to async.
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      version,
      input: {
        text,
        speaker: speakerDataUri,
        language: opts.language ?? "en",
        cleanup_voice: opts.cleanupVoice ?? true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Replicate XTTS create ${res.status}: ${body.slice(0, 200)}`);
  }

  let prediction = (await res.json()) as {
    id: string;
    status: string;
    output?: string | string[];
    error?: string;
    urls?: { get?: string };
  };

  // Sync path — output is already ready.
  if (prediction.status === "succeeded" && prediction.output) {
    return await downloadOutput(prediction.output);
  }

  // Async fallback — poll up to 3 minutes (XTTS short clips finish in 10-30s).
  const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${env.replicateToken}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Replicate poll ${pollRes.status}`);
    }
    prediction = (await pollRes.json()) as typeof prediction;
    if (prediction.status === "succeeded" && prediction.output) {
      return await downloadOutput(prediction.output);
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Replicate XTTS ${prediction.status}: ${prediction.error ?? "unknown"}`);
    }
  }
  throw new Error("Replicate XTTS timed out after 3 minutes");
}

async function downloadOutput(
  output: string | string[],
): Promise<{ bytes: Buffer; contentType: "audio/x-wav" }> {
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("Replicate XTTS returned no output URL");
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  return { bytes: bin, contentType: "audio/x-wav" };
}

/** Cache the resolved version per process. Replicate's version-listing endpoint
 *  requires auth, so we look it up lazily on first synth and reuse forever. */
let _xttsVersion: string | null = null;

async function getXttsLatestVersion(): Promise<string> {
  if (_xttsVersion) return _xttsVersion;
  const res = await fetch("https://api.replicate.com/v1/models/lucataco/xtts-v2", {
    headers: { Authorization: `Bearer ${env.replicateToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Replicate XTTS version lookup ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { latest_version?: { id?: string } };
  const id = data.latest_version?.id;
  if (!id) {
    throw new Error("Replicate XTTS-v2 has no latest_version");
  }
  console.log(`[xtts] resolved version id=${id.slice(0, 12)}…`);
  _xttsVersion = id;
  return id;
}
