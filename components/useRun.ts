"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  AgentName,
  BrandPersona,
  ContentRun,
  PlatformCopy,
  RunStage,
  StreamEvent,
} from "@/lib/types";

interface RunUIState {
  runId: string | null;
  stage: RunStage;
  events: StreamEvent[];
  /** Live, in-flight delta buffers per agent (cleared on result) */
  liveBuffers: Partial<Record<AgentName, string>>;
  run: Partial<ContentRun>;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

type Action =
  | { type: "start"; runId: string }
  | { type: "reset" }
  | { type: "event"; event: StreamEvent }
  | { type: "snapshot"; run: ContentRun };

const initial: RunUIState = {
  runId: null,
  stage: "queued",
  events: [],
  liveBuffers: {},
  run: {},
  startedAt: null,
  finishedAt: null,
  error: null,
};

function reducer(state: RunUIState, action: Action): RunUIState {
  switch (action.type) {
    case "reset":
      return initial;
    case "start":
      return { ...initial, runId: action.runId, startedAt: Date.now() };
    case "snapshot":
      return { ...state, run: { ...state.run, ...action.run } };
    case "event": {
      const e = action.event;
      let liveBuffers = state.liveBuffers;
      const run = { ...state.run };
      let stage = state.stage;
      let finishedAt = state.finishedAt;
      let error = state.error;

      if (e.type === "delta" && e.data && typeof e.data === "object") {
        const text = (e.data as { text?: string }).text ?? "";
        liveBuffers = { ...liveBuffers, [e.agent]: (liveBuffers[e.agent] ?? "") + text };
      }
      if (e.type === "result" || e.type === "tool-result") {
        if (e.type === "result") liveBuffers = { ...liveBuffers, [e.agent]: undefined };
        if (e.agent === "researcher" && e.type === "result")
          run.research = e.data as ContentRun["research"];
        if (e.agent === "strategist" && e.type === "result")
          run.strategy = e.data as ContentRun["strategy"];
        if (e.agent.startsWith("copywriter-") && e.type === "result") {
          const copy = e.data as PlatformCopy;
          const existing = run.copies ?? [];
          const filtered = existing.filter((c) => c.platform !== copy.platform);
          run.copies = [...filtered, copy];
        }
        if (e.agent === "coordinator" && e.data && typeof e.data === "object") {
          const d = e.data as { kind?: string; persona?: BrandPersona };
          if (d.kind === "persona-derived" && d.persona) {
            run.persona = d.persona;
          }
        }
        if (e.agent === "art-director" && e.data && typeof e.data === "object") {
          const d = e.data as { kind?: string; videoUrl?: string };
          if (d.kind === "avatar-upgraded" && d.videoUrl) {
            // Hot-swap the avatar across all compositions in place.
            run.compositions = (run.compositions ?? []).map((c) => ({
              ...c,
              sourceVideoUrl: d.videoUrl,
            }));
            run.assets = {
              ...(run.assets ?? { scriptHash: "" }),
              avatarVideoUrl: d.videoUrl,
            };
          }
        }
      }
      if (e.type === "stage" && e.stage) {
        stage = e.stage;
      }
      if (e.type === "complete") {
        finishedAt = Date.now();
        stage = "done";
      }
      if (e.type === "error") {
        error = e.message ?? "Unknown error";
        finishedAt = Date.now();
        stage = "error";
      }
      return {
        ...state,
        events: [...state.events, e],
        liveBuffers,
        run,
        stage,
        finishedAt,
        error,
      };
    }
  }
}

export function useRun() {
  const [state, dispatch] = useReducer(reducer, initial);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(async (message: string, url?: string) => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    dispatch({ type: "reset" });
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, url }),
    });
    if (!res.ok) {
      throw new Error(`Failed to start run: ${res.status}`);
    }
    const { runId } = (await res.json()) as { runId: string };
    dispatch({ type: "start", runId });

    const es = new EventSource(`/api/stream/${runId}`);
    esRef.current = es;
    const handler = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as StreamEvent;
        dispatch({ type: "event", event: parsed });
        if (parsed.type === "complete" || parsed.type === "error") {
          // Fetch full snapshot for compositions/assets
          void fetch(`/api/run/${runId}`)
            .then((r) => r.json())
            .then((j: { run: ContentRun }) => dispatch({ type: "snapshot", run: j.run }))
            .catch(() => undefined);
          es.close();
        }
      } catch {
        /* malformed */
      }
    };
    [
      "thinking",
      "tool-call",
      "tool-result",
      "delta",
      "result",
      "stage",
      "complete",
      "error",
    ].forEach((t) => es.addEventListener(t, handler as EventListener));
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  return { state, start, reset };
}
