"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { BrandPersona, RunStage } from "@/lib/types";
import { uid } from "@/lib/utils";

export type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
      runId: string;
      ts: number;
    }
  | {
      id: string;
      role: "cucu";
      runId: string;
      ts: number;
      /** Latest stage the run is at — drives the live status line in the bubble. */
      stage: RunStage;
      /** Hero angle when the strategist finishes. */
      hero?: string;
      /** Persona derived for this run. */
      persona?: BrandPersona;
      /** Once compositions land. */
      videoCount?: number;
      error?: string;
    };

interface State {
  messages: ChatMessage[];
}

type Action =
  | { type: "user-send"; text: string; runId: string }
  | { type: "stage"; runId: string; stage: RunStage }
  | { type: "hero"; runId: string; hero: string }
  | { type: "persona"; runId: string; persona: BrandPersona }
  | { type: "video-count"; runId: string; count: number }
  | { type: "error"; runId: string; message: string }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "clear":
      return { messages: [] };
    case "user-send": {
      const user: ChatMessage = {
        id: uid("m_"),
        role: "user",
        text: action.text,
        runId: action.runId,
        ts: Date.now(),
      };
      const cucu: ChatMessage = {
        id: uid("m_"),
        role: "cucu",
        runId: action.runId,
        ts: Date.now() + 1,
        stage: "queued",
      };
      return { messages: [...state.messages, user, cucu] };
    }
    case "stage":
    case "hero":
    case "persona":
    case "video-count":
    case "error":
      return {
        messages: state.messages.map((m) => {
          if (m.role !== "cucu" || m.runId !== action.runId) return m;
          if (action.type === "stage") return { ...m, stage: action.stage };
          if (action.type === "hero") return { ...m, hero: action.hero };
          if (action.type === "persona") return { ...m, persona: action.persona };
          if (action.type === "video-count") return { ...m, videoCount: action.count };
          if (action.type === "error") return { ...m, error: action.message, stage: "error" };
          return m;
        }),
      };
  }
}

interface SyncInputs {
  runId: string | null;
  stage: RunStage;
  hero: string | undefined;
  persona: BrandPersona | undefined;
  videoCount: number;
  error: string | null;
}

export function useChatHistory(sync: SyncInputs) {
  const [state, dispatch] = useReducer(reducer, { messages: [] });

  // Mirror the active run's state into the matching cucu bubble.
  useEffect(() => {
    if (!sync.runId) return;
    dispatch({ type: "stage", runId: sync.runId, stage: sync.stage });
  }, [sync.runId, sync.stage]);

  useEffect(() => {
    if (!sync.runId || !sync.hero) return;
    dispatch({ type: "hero", runId: sync.runId, hero: sync.hero });
  }, [sync.runId, sync.hero]);

  useEffect(() => {
    if (!sync.runId || !sync.persona) return;
    dispatch({ type: "persona", runId: sync.runId, persona: sync.persona });
  }, [sync.runId, sync.persona]);

  useEffect(() => {
    if (!sync.runId || sync.videoCount === 0) return;
    dispatch({ type: "video-count", runId: sync.runId, count: sync.videoCount });
  }, [sync.runId, sync.videoCount]);

  useEffect(() => {
    if (!sync.runId || !sync.error) return;
    dispatch({ type: "error", runId: sync.runId, message: sync.error });
  }, [sync.runId, sync.error]);

  const appendUser = useCallback((text: string, runId: string) => {
    dispatch({ type: "user-send", text, runId });
  }, []);

  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return { messages: state.messages, appendUser, clear };
}
