import type { StreamEvent } from "./types";

const encoder = new TextEncoder();

export function sseLine(event: StreamEvent): Uint8Array {
  // SSE format: `id:`, `event:`, `data:` newline-delimited, blank line terminator.
  const payload = JSON.stringify(event);
  return encoder.encode(
    `id: ${event.seq}\nevent: ${event.type}\ndata: ${payload}\n\n`,
  );
}

export function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}
