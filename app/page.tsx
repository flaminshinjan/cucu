"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { RunStage } from "@/components/RunStage";
import { Card } from "@/components/ui/card";
import { useRun } from "@/components/useRun";
import { useStudioConfig } from "@/components/useStudioConfig";
import { useChatHistory } from "@/components/useChatHistory";
import { useRunHistory } from "@/components/useRunHistory";
import { cn } from "@/lib/utils";
import type { ContentRun } from "@/lib/types";

interface Caps {
  hasAnthropic: boolean;
  hasTavily: boolean;
  hasTTS: boolean;
  hasAvatar: boolean;
  hasReplicate: boolean;
  hasSupabase: boolean;
  hasVoiceClone: boolean;
}

interface Example {
  label: string;
  text: string;
}

export default function Home() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [capabilities, setCapabilities] = useState<Caps | null>(null);
  const { state, start, reset: _reset, loadFromHistory } = useRun();
  const { config: studioConfig, setConfig: setStudioConfig } = useStudioConfig();
  const { history, saveRun, removeRun, clear: clearHistory } = useRunHistory();
  void _reset;

  useEffect(() => {
    void fetch("/api/personas")
      .then((r) => r.json())
      .then((j: { examples: Example[]; capabilities: Caps }) => {
        setExamples(j.examples);
        setCapabilities(j.capabilities);
      })
      .catch(() => undefined);
  }, []);

  const persona = state.run.persona ?? null;
  const running = state.runId !== null && state.stage !== "done" && state.stage !== "error";
  const hasRun = state.runId !== null;

  // Auto-save a completed run to localStorage once compositions land.
  // We save whenever stage hits "done" AND we have at least one composition.
  // The hook dedupes by run.id so re-saving when avatar hot-swaps just updates the entry.
  useEffect(() => {
    if (
      state.runId &&
      state.stage === "done" &&
      (state.run.compositions?.length ?? 0) > 0 &&
      state.run.persona
    ) {
      saveRun(state.run as ContentRun);
    }
  }, [
    state.runId,
    state.stage,
    state.run.compositions?.length,
    state.run.assets?.avatarVideoUrl,
    saveRun,
    state.run,
  ]);

  const { messages, appendUser } = useChatHistory({
    runId: state.runId,
    stage: state.stage,
    hero: state.run.strategy?.hero?.angle,
    persona: state.run.persona,
    videoCount: state.run.compositions?.length ?? 0,
    error: state.error,
  });

  async function handleSend(message: string) {
    try {
      // Kick off the run, then append a user+cucu message pair tied to the new runId.
      // We do this in order: start() resolves with the run id, then chat history
      // mirrors the live run state.
      // useRun.start dispatches a "start" action with the runId — we'll grab it
      // from the next state. For simplicity we patch the chat history via the
      // resolved runId returned by start.
      const runId = await start(message, { studio: studioConfig });
      if (runId) appendUser(message, runId);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <main className="relative h-screen overflow-hidden flex flex-col">
      <Header running={running} />

      <div className="flex-1 min-h-0 px-4 md:px-6 pb-4 grid gap-4 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-5 min-h-0 overflow-hidden flex flex-col">
          <ChatPanel
            examples={examples}
            messages={messages}
            running={running}
            activeRunId={state.runId}
            onSend={handleSend}
            capabilities={capabilities}
            studioConfig={studioConfig}
            onStudioChange={setStudioConfig}
            history={history}
            onLoadFromHistory={loadFromHistory}
            onRemoveFromHistory={removeRun}
            onClearHistory={clearHistory}
          />
        </Card>

        <Card className="p-6 min-h-0 overflow-hidden flex flex-col">
          <RunStage
            persona={persona}
            run={state.run}
            events={state.events}
            liveBuffers={state.liveBuffers}
            stage={state.stage}
            startedAt={state.startedAt}
            finishedAt={state.finishedAt}
            error={state.error}
            hasRun={hasRun}
          />
        </Card>
      </div>
    </main>
  );
}

function Header({ running }: { running: boolean }) {
  return (
    <header className="px-5 md:px-8 py-4 flex items-center justify-between shrink-0">
      <div className="flex items-end gap-3">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-display text-4xl md:text-5xl tracking-tightest text-ink-800">
            cucu
          </span>
          <span className="h-2 w-2 rounded-full bg-signal-500 mb-2" />
        </div>
        <div className="hidden sm:block mb-1.5 text-[11px] uppercase tracking-[0.22em] text-ink-400">
          Multi-platform content, on demand
        </div>
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider font-medium",
          running
            ? "border-signal-300 bg-signal-50 text-signal-700"
            : "border-ink-200 bg-cream-100 text-ink-500",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            running ? "bg-signal-500 animate-pulse" : "bg-ink-300",
          )}
        />
        {running ? "Running" : "Ready"}
      </div>
    </header>
  );
}
