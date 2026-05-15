import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveBrand } from "@/lib/personas";
import { createRun, emit, updateRun } from "@/lib/store";
import { orchestrate } from "@/lib/agents/coordinator";
import { uid } from "@/lib/utils";
import type { ContentRun } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().trim().min(2).max(4000),
  url: z.string().trim().max(2048).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const message = parsed.data.message.trim();
  const explicitUrl = parsed.data.url?.trim();
  // Auto-extract a URL from the message if one wasn't passed explicitly.
  const urlMatch = !explicitUrl ? message.match(/\bhttps?:\/\/[^\s)]+/i) : null;
  const url = explicitUrl || urlMatch?.[0];

  // Skeleton run is created immediately so the SSE stream can attach.
  const runId = uid("r_");
  const run: ContentRun = {
    id: runId,
    message,
    brief: url ? { url, focus: message } : { focus: message },
    createdAt: Date.now(),
    stage: "queued",
  };
  createRun(run);

  // Derive the brand persona + then orchestrate. Both happen in background.
  void (async () => {
    try {
      emit(runId, {
        ts: Date.now(),
        agent: "coordinator",
        type: "tool-call",
        message: "brand.derive",
        data: { messagePreview: message.slice(0, 120) },
      });
      const persona = await deriveBrand(message, runId);
      updateRun(runId, { persona });
      emit(runId, {
        ts: Date.now(),
        agent: "coordinator",
        type: "tool-result",
        message: `Derived brand: ${persona.name}`,
        data: { kind: "persona-derived", persona },
      });

      await orchestrate({ ...run, persona }, persona);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Derive+orchestrate failed", e);
      emit(runId, {
        ts: Date.now(),
        agent: "coordinator",
        type: "error",
        message,
      });
    }
  })();

  return NextResponse.json({ runId });
}
