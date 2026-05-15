import type { ContentRun, StreamEvent, RunStage } from "./types";
import { storage } from "./adapters/storage";

/**
 * In-memory event bus for the current process + JSON persistence for snapshots.
 *
 * In production behind a load balancer this would move to Postgres LISTEN/NOTIFY
 * or Redis pub/sub — but on Fly with a single instance, in-memory is correct
 * and simpler. The persistence layer lets a refreshed UI catch up.
 */

interface RunState {
  run: ContentRun;
  events: StreamEvent[];
  subscribers: Set<(e: StreamEvent) => void>;
  closed: boolean;
}

// Stored on globalThis so Next.js dev mode HMR (and any route-handler
// isolation) doesn't drop in-flight runs between POST and GET requests.
const globalAny = globalThis as unknown as { __runs?: Map<string, RunState> };
const runs: Map<string, RunState> = globalAny.__runs ?? new Map();
globalAny.__runs = runs;

export function createRun(run: ContentRun): RunState {
  const state: RunState = {
    run,
    events: [],
    subscribers: new Set(),
    closed: false,
  };
  runs.set(run.id, state);
  void storage.putJSON(`runs/${run.id}`, run);
  return state;
}

export function getRun(id: string): RunState | undefined {
  return runs.get(id);
}

export async function loadRunFromDisk(id: string): Promise<ContentRun | null> {
  return storage.getJSON<ContentRun>(`runs/${id}`);
}

export function updateRun(id: string, patch: Partial<ContentRun>): ContentRun | undefined {
  const state = runs.get(id);
  if (!state) return undefined;
  state.run = { ...state.run, ...patch };
  void storage.putJSON(`runs/${id}`, state.run);
  return state.run;
}

export function setStage(id: string, stage: RunStage) {
  const updated = updateRun(id, { stage });
  if (updated) {
    emit(id, {
      seq: -1, // overwritten in emit
      ts: Date.now(),
      agent: "coordinator",
      type: "stage",
      stage,
      message: stageHumanLabel(stage),
    });
  }
}

/** Patch compositions for a run after it has already completed (e.g. avatar upgrade). */
export function patchAvatarOnAllCompositions(id: string, videoUrl: string) {
  const state = runs.get(id);
  if (!state) return;
  const compositions = (state.run.compositions ?? []).map((c) => ({
    ...c,
    sourceVideoUrl: videoUrl,
  }));
  const assets = { ...(state.run.assets ?? { scriptHash: "" }), avatarVideoUrl: videoUrl };
  state.run = { ...state.run, compositions, assets };
  void storage.putJSON(`runs/${id}`, state.run);
}

export function emit(id: string, event: Omit<StreamEvent, "seq"> & { seq?: number }) {
  const state = runs.get(id);
  if (!state || state.closed) return;
  const seq = state.events.length;
  const ev: StreamEvent = { ...event, seq };
  state.events.push(ev);
  for (const sub of state.subscribers) {
    try {
      sub(ev);
    } catch (e) {
      console.warn("subscriber error", e);
    }
  }
}

export function complete(id: string) {
  emit(id, { ts: Date.now(), agent: "coordinator", type: "complete", message: "Done" });
  const state = runs.get(id);
  if (state) state.closed = true;
}

export function fail(id: string, error: string) {
  emit(id, { ts: Date.now(), agent: "coordinator", type: "error", message: error });
  updateRun(id, { stage: "error", error });
  const state = runs.get(id);
  if (state) state.closed = true;
}

export function subscribe(
  id: string,
  cb: (e: StreamEvent) => void,
  fromSeq = 0,
): () => void {
  const state = runs.get(id);
  if (!state) return () => {};
  // Replay backlog so reconnecting clients catch up
  for (const e of state.events) {
    if (e.seq >= fromSeq) cb(e);
  }
  if (state.closed) {
    return () => {};
  }
  state.subscribers.add(cb);
  return () => state.subscribers.delete(cb);
}

function stageHumanLabel(stage: RunStage): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "researching":
      return "Researching the niche";
    case "strategizing":
      return "Designing content strategy";
    case "writing":
      return "Writing platform copy";
    case "voicing":
      return "Generating voiceover";
    case "rendering":
      return "Rendering avatar";
    case "composing":
      return "Composing platform variants";
    case "done":
      return "Done";
    case "error":
      return "Errored";
  }
}
