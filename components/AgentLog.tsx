"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Pencil,
  Search,
  Sparkles,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AgentName, RunStage, StreamEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  events: StreamEvent[];
  liveBuffers: Partial<Record<AgentName, string>>;
  stage: RunStage;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const AGENT_META: Record<
  AgentName,
  { label: string; icon: LucideIcon; dot: string }
> = {
  coordinator: { label: "Coordinator", icon: Sparkles, dot: "bg-signal-500" },
  researcher: { label: "Researcher", icon: Search, dot: "bg-sky-500" },
  strategist: { label: "Strategist", icon: Brain, dot: "bg-violet-500" },
  "copywriter-linkedin": { label: "Copy · LinkedIn", icon: Pencil, dot: "bg-[#0A66C2]" },
  "copywriter-youtube": { label: "Copy · YouTube", icon: Pencil, dot: "bg-rose-500" },
  "copywriter-instagram": { label: "Copy · Instagram", icon: Pencil, dot: "bg-pink-500" },
  "copywriter-x": { label: "Copy · X", icon: Pencil, dot: "bg-ink-700" },
  "art-director": { label: "Art Director", icon: ImageIcon, dot: "bg-amber-500" },
};

const STAGE_ORDER: RunStage[] = [
  "researching",
  "strategizing",
  "writing",
  "voicing",
  "rendering",
  "composing",
  "done",
];

const STAGE_LABEL: Record<RunStage, string> = {
  queued: "Queued",
  researching: "Research",
  strategizing: "Strategy",
  writing: "Copy",
  voicing: "Voice",
  rendering: "Avatar",
  composing: "Compose",
  done: "Done",
  error: "Error",
};

export function AgentLog({
  events,
  liveBuffers,
  stage,
  startedAt,
  finishedAt,
  error,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, liveBuffers]);

  const visibleEvents = useMemo(
    () => events.filter((e) => e.type !== "delta" && e.type !== "stage"),
    [events],
  );

  const elapsedSeconds =
    startedAt && (finishedAt ?? Date.now())
      ? Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000)
      : 0;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display text-xl text-ink-800 leading-none">
            cucu, thinking
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            02
          </span>
        </div>
        <div className="text-xs text-ink-500 flex items-center gap-2">
          {startedAt ? (
            <>
              <span className="tabular-nums">{elapsedSeconds}s</span>
              <Dot />
              <span>
                {stage === "done"
                  ? "complete"
                  : error
                    ? "errored"
                    : `${STAGE_LABEL[stage].toLowerCase()}`}
              </span>
            </>
          ) : (
            <span>Pick a brand and run. Watch the agents work.</span>
          )}
        </div>

        {/* Compact stage timeline */}
        <div className="mt-3 flex items-stretch gap-1">
          {STAGE_ORDER.map((s, i) => {
            const isCurrent = stage === s;
            const idx = STAGE_ORDER.indexOf(stage);
            const isPast = idx > i && stage !== "queued";
            return (
              <div key={s} className="flex-1 flex flex-col gap-1">
                <div
                  className={cn(
                    "h-1 rounded-full transition-all",
                    isCurrent
                      ? "bg-signal-500 shimmer"
                      : isPast
                        ? "bg-ink-700"
                        : "bg-ink-100",
                  )}
                />
                <span
                  className={cn(
                    "text-[9.5px] uppercase tracking-wider font-medium hidden md:inline-block",
                    isCurrent
                      ? "text-signal-700"
                      : isPast
                        ? "text-ink-600"
                        : "text-ink-300",
                  )}
                >
                  {STAGE_LABEL[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2 pr-1"
      >
        {visibleEvents.length === 0 && !startedAt && <EmptyState />}
        <AnimatePresence initial={false}>
          {visibleEvents.map((e) => (
            <LogRow key={e.seq} event={e} />
          ))}
        </AnimatePresence>

        {/* Live in-flight buffers — show what each agent is currently writing */}
        {Object.entries(liveBuffers)
          .filter(([, txt]) => !!txt)
          .map(([agent, txt]) => (
            <LiveDelta key={`live-${agent}`} agent={agent as AgentName} text={txt ?? ""} />
          ))}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="font-medium mb-1">Run failed</div>
            <div className="opacity-80">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-ink-300" />;
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12">
      <div className="relative h-14 w-14 mb-5">
        <div className="absolute inset-0 rounded-full bg-signal-200/40 animate-pulse-ring" />
        <div className="absolute inset-2 rounded-full bg-signal-500 flex items-center justify-center text-white">
          <Sparkles size={18} />
        </div>
      </div>
      <p className="font-display text-2xl text-ink-700 leading-tight max-w-[16rem] text-balance">
        Idle. Press run.
      </p>
      <p className="text-xs text-ink-400 mt-2 max-w-[18rem]">
        Researcher, Strategist, four Copywriters and an Art Director will
        stream their work into this column.
      </p>
    </div>
  );
}

function LogRow({ event }: { event: StreamEvent }) {
  const meta = AGENT_META[event.agent];
  const Icon =
    event.type === "tool-call" || event.type === "tool-result"
      ? Wrench
      : event.type === "complete"
        ? CheckCircle2
        : event.type === "error"
          ? AlertTriangle
          : meta?.icon ?? Sparkles;

  const tone =
    event.type === "tool-call"
      ? "border-sky-200 bg-sky-50/60"
      : event.type === "tool-result"
        ? "border-sky-200 bg-sky-50/40"
        : event.type === "result"
          ? "border-emerald-200 bg-emerald-50/50"
          : event.type === "error"
            ? "border-red-200 bg-red-50"
            : event.type === "complete"
              ? "border-signal-200 bg-signal-50/60"
              : "border-ink-100 bg-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs flex items-start gap-2.5",
        tone,
      )}
    >
      <div className="mt-0.5 shrink-0 flex items-center justify-center">
        <span className={cn("h-5 w-5 rounded-md flex items-center justify-center", meta?.dot ?? "bg-ink-700")}>
          <Icon size={11} className="text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-ink-800">
            {meta?.label ?? event.agent}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-ink-400">
            {event.type.replace("-", " ")}
          </span>
        </div>
        {event.message && (
          <div className="mt-0.5 text-ink-700 leading-snug">{event.message}</div>
        )}
        {event.type === "tool-result" && event.data && typeof event.data === "object" ? (
          <ToolResultPreview data={event.data} />
        ) : null}
      </div>
    </motion.div>
  );
}

function ToolResultPreview({ data }: { data: unknown }) {
  if (
    data &&
    typeof data === "object" &&
    "sample" in data &&
    Array.isArray((data as { sample: unknown[] }).sample)
  ) {
    const sample = (data as { sample: string[] }).sample;
    return (
      <ul className="mt-1 space-y-0.5">
        {sample.map((s, i) => (
          <li key={i} className="text-[11px] text-ink-500 truncate">
            · {s}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

function LiveDelta({ agent, text }: { agent: AgentName; text: string }) {
  const meta = AGENT_META[agent];
  const Icon = meta?.icon ?? Sparkles;
  const tail = text.slice(-220);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-lg border border-signal-200 bg-signal-50/40 px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-5 w-5 rounded-md bg-signal-500 flex items-center justify-center">
          <Icon size={11} className="text-white" />
        </span>
        <span className="font-semibold text-ink-800">
          {meta?.label ?? agent}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-signal-700 animate-pulse">
          streaming
        </span>
      </div>
      <pre className="font-mono text-[11px] text-ink-700 whitespace-pre-wrap break-words leading-relaxed">
        {tail}
        <span className="inline-block w-1.5 h-3 align-text-bottom bg-signal-500 ml-0.5 animate-pulse" />
      </pre>
    </motion.div>
  );
}
