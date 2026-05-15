import { NextResponse } from "next/server";
import { uploadTalkingPhoto } from "@/lib/adapters/heygen";
import { capabilities } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  if (!capabilities.hasAvatar) {
    return NextResponse.json(
      { error: "Avatar provider not configured (set HEYGEN_API_KEY)" },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type ${file.type}. Use JPEG, PNG, or WebP.` },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const out = await uploadTalkingPhoto(bytes, file.type);
    return NextResponse.json(out);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Talking photo upload failed", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
