import { NextResponse } from "next/server";
import { cloneVoice } from "@/lib/adapters/heygen";
import { capabilities } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/webm", "audio/ogg", "audio/m4a", "audio/mp4"]);

export async function POST(req: Request) {
  if (!capabilities.hasAvatar) {
    return NextResponse.json(
      { error: "Voice cloning requires HEYGEN_API_KEY" },
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
  try {
    const out = await cloneVoice(bytes, file.type, name);
    return NextResponse.json(out);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Voice clone failed", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
