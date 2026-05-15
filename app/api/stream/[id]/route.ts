import { NextRequest } from "next/server";
import { getRun, subscribe } from "@/lib/store";
import { sseComment, sseLine } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params;
  const state = getRun(id);
  if (!state) {
    return new Response(JSON.stringify({ error: "Unknown run" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Reconnect support: client passes Last-Event-ID
  const lastSeqHeader = req.headers.get("last-event-id");
  const lastSeq = lastSeqHeader ? Number(lastSeqHeader) : -1;
  const fromSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial heartbeat & retry hint
      controller.enqueue(sseComment("connected"));
      controller.enqueue(new TextEncoder().encode("retry: 2000\n\n"));

      const unsubscribe = subscribe(
        id,
        (event) => {
          try {
            controller.enqueue(sseLine(event));
            if (event.type === "complete" || event.type === "error") {
              controller.enqueue(sseComment("stream closing"));
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          } catch {
            /* controller already closed */
          }
        },
        fromSeq,
      );

      // Keep-alive ping every 15s — also keeps Fly's proxy from idle-closing us
      const ping = setInterval(() => {
        try {
          controller.enqueue(sseComment("ping"));
        } catch {
          clearInterval(ping);
        }
      }, 15000);

      const onAbort = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
