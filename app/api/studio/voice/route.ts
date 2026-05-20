import { NextResponse } from "next/server";
import { storage } from "@/lib/adapters/storage";
import { capabilities } from "@/lib/env";
import { hashString } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
]);

/**
 * Voice cloning lives on Replicate XTTS-v2 (zero-shot). Upload here just
 * stashes the sample audio in cucu's storage and returns its storage key.
 * At render time the avatar adapter reads the bytes back, inlines them as a
 * data URI alongside the script, and asks Replicate to synthesize.
 */
export async function POST(req: Request) {
  if (!capabilities.hasVoiceClone) {
    return NextResponse.json(
      {
        error:
          "Voice cloning requires REPLICATE_API_TOKEN. cucu runs Coqui XTTS-v2 on Replicate (zero-shot — no separate clone step) and lipsyncs the result with HeyGen.",
      },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const nameRaw = form?.get("name");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported audio type ${file.type}. Use MP3, WAV, M4A, or OGG.` },
      { status: 415 },
    );
  }

  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "cucu clone";
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = pickExt(file.type, file.name);
  const key = `voices/samples/${hashString(bytes.toString("base64").slice(0, 1024) + name)}.${ext}`;

  try {
    await storage.put(key, bytes, file.type);
    return NextResponse.json({
      voiceId: key,
      name,
      provider: "replicate",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Voice sample upload failed", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function pickExt(contentType: string, fallbackName: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };
  if (map[contentType]) return map[contentType];
  const m = fallbackName.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "mp3";
}
