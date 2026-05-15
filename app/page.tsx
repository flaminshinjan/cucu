"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { RunStage } from "@/components/RunStage";
import { Card } from "@/components/ui/card";
import { useRun } from "@/components/useRun";
import { cn } from "@/lib/utils";

interface Caps {
  hasAnthropic: boolean;
  hasTavily: boolean;
  hasTTS: boolean;
  hasAvatar: boolean;
  hasReplicate: boolean;
  hasSupabase: boolean;
}

interface Example {
  label: string;
  text: string;
}

export default function Home() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [capabilities, setCapabilities] = useState<Caps | null>(null);
  const { state, start, reset } = useRun();

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
  const hasResult = state.stage === "done" && (state.run.compositions?.length ?? 0) > 0;

  async function handleRun(message: string) {
    try {
      await start(message);
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
            derivedPersona={persona ?? undefined}
            running={running}
            hasResult={hasResult}
            onRun={handleRun}
            onReset={reset}
            capabilities={capabilities}
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
