"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Compass,
  Film,
  Megaphone,
  Mic2,
  PencilLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  AgentName,
  BrandPersona,
  ContentRun,
  PlatformId,
  RunStage,
  StreamEvent,
} from "@/lib/types";
import { PLATFORMS, PLATFORM_ORDER } from "@/lib/platforms";
import { PlatformFrame } from "@/components/PlatformFrame";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  persona: BrandPersona | null;
  run: Partial<ContentRun>;
  events: StreamEvent[];
  liveBuffers: Partial<Record<AgentName, string>>;
  stage: RunStage;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  hasRun: boolean;
}

const STAGE_FLOW: RunStage[] = [
  "researching",
  "strategizing",
  "writing",
  "voicing",
  "rendering",
  "composing",
  "done",
];

const STAGE_LABEL: Record<RunStage, string> = {
  queued: "Starting up",
  researching: "Researching",
  strategizing: "Strategizing",
  writing: "Writing",
  voicing: "Voicing",
  rendering: "Rendering avatar",
  composing: "Composing",
  done: "Done",
  error: "Error",
};

const STAGE_SUBLABEL: Record<RunStage, string> = {
  queued: "Deriving the brand",
  researching: "Pulling trending topics, competitor angles, and audience pain points",
  strategizing: "Designing pillars, weekly plan, and the hero angle",
  writing: "Four copywriters drafting platform-tailored copy in parallel",
  voicing: "Generating the voiceover from the hero script",
  rendering: "Avatar rendering in the background",
  composing: "Assembling per-platform variants with timed captions",
  done: "Four platform-native posts, ready",
  error: "Something stopped the run",
};

const STAGE_ICON: Record<RunStage, LucideIcon> = {
  queued: Sparkles,
  researching: Compass,
  strategizing: Brain,
  writing: PencilLine,
  voicing: Mic2,
  rendering: Film,
  composing: Megaphone,
  done: CheckCircle2,
  error: AlertTriangle,
};

export function RunStage({
  persona,
  run,
  events,
  liveBuffers,
  stage,
  startedAt,
  finishedAt,
  error,
  hasRun,
}: Props) {
  if (!hasRun) {
    return <IdleState />;
  }
  if (error) {
    return <ErrorState error={error} />;
  }
  if (stage === "done") {
    return <OutputView persona={persona} run={run} />;
  }
  return (
    <ProgressView
      persona={persona}
      run={run}
      events={events}
      liveBuffers={liveBuffers}
      stage={stage}
      startedAt={startedAt}
      finishedAt={finishedAt}
    />
  );
}

/* ───────────────────────── idle ───────────────────────── */

function IdleState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="relative mb-8">
        <span className="font-display text-[10rem] leading-none text-ink-100 select-none">
          c
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-signal-500 animate-pulse" />
        </div>
      </div>
      <p className="font-display text-3xl text-ink-800 leading-tight max-w-md text-balance">
        Tell cucu what to make.
      </p>
      <p className="text-sm text-ink-500 mt-3 max-w-md text-balance">
        cucu researches the niche, designs a strategy, writes four platform
        drafts, voices them, and renders an AI avatar — all streamed here in
        under three minutes.
      </p>
      <div className="mt-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-400">
        <span>Researcher</span>
        <span className="h-1 w-1 rounded-full bg-ink-300" />
        <span>Strategist</span>
        <span className="h-1 w-1 rounded-full bg-ink-300" />
        <span>4× Copywriter</span>
        <span className="h-1 w-1 rounded-full bg-ink-300" />
        <span>Art Director</span>
      </div>
    </div>
  );
}

/* ───────────────────────── error ───────────────────────── */

function ErrorState({ error }: { error: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="h-12 w-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-5">
        <AlertTriangle size={20} />
      </div>
      <p className="font-display text-2xl text-ink-800">cucu hit a snag.</p>
      <p className="text-sm text-ink-500 mt-2 max-w-md text-balance">{error}</p>
    </div>
  );
}

/* ───────────────────────── progress ───────────────────────── */

interface ProgressProps {
  persona: BrandPersona | null;
  run: Partial<ContentRun>;
  events: StreamEvent[];
  liveBuffers: Partial<Record<AgentName, string>>;
  stage: RunStage;
  startedAt: number | null;
  finishedAt: number | null;
}

function ProgressView({
  persona,
  run,
  events,
  liveBuffers,
  stage,
  startedAt,
}: ProgressProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const elapsed = startedAt ? Math.round((now - startedAt) / 1000) : 0;

  const currentIndex = Math.max(0, STAGE_FLOW.indexOf(stage));
  const progress = Math.min(1, (currentIndex + 0.5) / STAGE_FLOW.length);

  // Pick the most recent agent activity for the "now happening" line
  const latestEvent = events
    .filter((e) => e.message && e.type !== "delta" && e.type !== "stage")
    .slice(-1)[0];

  const Icon = STAGE_ICON[stage];

  return (
    <div className="flex flex-col h-full min-h-0 gap-5">
      {/* Hero — current stage */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-signal-700 font-semibold">
            cucu is working
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 tabular-nums">
            {String(elapsed).padStart(2, "0")}s elapsed
          </span>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-signal-200/50 animate-pulse-ring" />
            <div className="relative h-14 w-14 rounded-2xl bg-signal-500 text-white flex items-center justify-center shadow-[0_10px_30px_-12px_rgba(242,64,22,0.5)]">
              <Icon size={22} />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl text-ink-800 leading-tight">
              {STAGE_LABEL[stage]}
              <span className="text-signal-500">.</span>
            </h2>
            <p className="text-sm text-ink-500 leading-snug mt-0.5 text-balance">
              {STAGE_SUBLABEL[stage]}
            </p>
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
          <motion.div
            className="h-full bg-signal-500"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Stage chips */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {STAGE_FLOW.map((s, i) => {
            const isPast = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div
                key={s}
                className="flex flex-col items-center gap-1 text-center"
              >
                <div
                  className={cn(
                    "h-1 w-full rounded-full transition-all",
                    isCurrent
                      ? "bg-signal-500"
                      : isPast
                        ? "bg-ink-700"
                        : "bg-ink-100",
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-wider font-medium hidden md:block",
                    isCurrent
                      ? "text-signal-700"
                      : isPast
                        ? "text-ink-600"
                        : "text-ink-300",
                  )}
                >
                  {STAGE_LABEL[s].split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Materializing results — show as they land */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-3">
        {persona && <BrandDerivedCard persona={persona} />}
        {run.research && <ResearchCard summary={run.research.summary} />}
        {run.strategy && <StrategyCard hero={run.strategy.hero.angle} />}
        {run.copies && run.copies.length > 0 && (
          <CopyProgressCard count={run.copies.length} />
        )}

        {/* Now-happening line */}
        <NowHappeningLine
          stage={stage}
          latestEvent={latestEvent}
          liveBuffers={liveBuffers}
        />
      </div>
    </div>
  );
}

function NowHappeningLine({
  stage,
  latestEvent,
  liveBuffers,
}: {
  stage: RunStage;
  latestEvent: StreamEvent | undefined;
  liveBuffers: Partial<Record<AgentName, string>>;
}) {
  const liveAgent = useMemo(() => {
    const e = Object.entries(liveBuffers).find(([, t]) => !!t);
    if (!e) return null;
    return { agent: e[0] as AgentName, text: e[1] ?? "" };
  }, [liveBuffers]);

  if (liveAgent) {
    const tail = liveAgent.text.slice(-140);
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-signal-200 bg-signal-50/50 px-4 py-3"
      >
        <div className="text-[10px] uppercase tracking-wider text-signal-700 font-semibold mb-1">
          {AGENT_DISPLAY[liveAgent.agent] ?? liveAgent.agent}
        </div>
        <div className="font-mono text-[11.5px] text-ink-700 leading-relaxed whitespace-pre-wrap break-words">
          {tail}
          <span className="inline-block w-1.5 h-3 align-text-bottom bg-signal-500 ml-0.5 animate-pulse" />
        </div>
      </motion.div>
    );
  }

  if (latestEvent?.message) {
    return (
      <motion.div
        key={latestEvent.seq}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-700"
      >
        <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
          {AGENT_DISPLAY[latestEvent.agent] ?? latestEvent.agent}
        </div>
        {latestEvent.message}
      </motion.div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-500 italic">
      Warming up…
    </div>
  );
}

const AGENT_DISPLAY: Partial<Record<AgentName, string>> = {
  coordinator: "Coordinator",
  researcher: "Researcher",
  strategist: "Strategist",
  "copywriter-linkedin": "LinkedIn writer",
  "copywriter-youtube": "YouTube writer",
  "copywriter-instagram": "Instagram writer",
  "copywriter-x": "X writer",
  "art-director": "Art Director",
};

function BrandDerivedCard({ persona }: { persona: BrandPersona }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-ink-100 bg-white p-4 flex items-start gap-3"
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-ink-100"
        style={{
          background: `linear-gradient(135deg, ${persona.primaryColor}22, ${persona.accentColor}38)`,
        }}
      >
        {persona.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="success">Brand derived</Badge>
          <h3 className="font-display text-lg text-ink-800 leading-none truncate">
            {persona.name}
          </h3>
        </div>
        <p className="text-[12px] text-ink-500 mt-1 leading-snug line-clamp-2">
          {persona.tagline}
        </p>
      </div>
    </motion.div>
  );
}

function ResearchCard({ summary }: { summary: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-ink-100 bg-white p-4"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant="success">Research</Badge>
        <span className="text-[10px] text-ink-400 uppercase tracking-wider">
          summary
        </span>
      </div>
      <p className="text-[13px] text-ink-700 leading-relaxed line-clamp-3">
        {summary}
      </p>
    </motion.div>
  );
}

function StrategyCard({ hero }: { hero: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-ink-200 bg-cream-50 p-4 relative overflow-hidden"
    >
      <div className="absolute -top-6 -right-6 font-display text-[7rem] text-signal-100 leading-none select-none">
        ✦
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="success">Strategy</Badge>
          <span className="text-[10px] text-ink-400 uppercase tracking-wider">
            hero angle
          </span>
        </div>
        <p className="font-display text-xl text-ink-800 leading-snug text-balance">
          <span className="ink-underline">{hero}</span>
        </p>
      </div>
    </motion.div>
  );
}

function CopyProgressCard({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-ink-100 bg-white p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="success">Copy</Badge>
        <span className="text-[10px] text-ink-400 uppercase tracking-wider">
          {count} of 4 platforms
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PLATFORM_ORDER.map((id, i) => {
          const p = PLATFORMS[id];
          const done = i < count;
          return (
            <div
              key={id}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-center transition-all",
                done
                  ? "border-ink-200 bg-cream-50"
                  : "border-ink-100 bg-white",
              )}
            >
              <div className="flex items-center justify-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: done ? p.brandColor : "#D1CFCB" }}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    done ? "text-ink-800" : "text-ink-400",
                  )}
                >
                  {p.shortName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ───────────────────────── output ───────────────────────── */

function OutputView({
  persona,
  run,
}: {
  persona: BrandPersona | null;
  run: Partial<ContentRun>;
}) {
  const [playingId, setPlayingId] = useState<PlatformId | null>(null);
  const compositions = run.compositions ?? [];
  const ordered = PLATFORM_ORDER.map((id) =>
    compositions.find((c) => c.platform === id),
  ).filter((c): c is NonNullable<typeof c> => !!c);

  if (!persona || ordered.length === 0) {
    return <IdleState />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">
              Four platforms ready
            </span>
          </div>
          <h2 className="font-display text-3xl text-ink-800 leading-tight text-balance">
            {run.strategy?.hero.angle ?? "Your content is ready."}
          </h2>
          <p className="text-[12px] text-ink-500 mt-1.5 flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-md flex items-center justify-center text-[13px] ring-1 ring-ink-100"
              style={{
                background: `linear-gradient(135deg, ${persona.primaryColor}1A, ${persona.accentColor}2A)`,
              }}
            >
              {persona.emoji}
            </span>
            <span className="text-ink-700 font-medium">{persona.name}</span>
            <span className="text-ink-300">·</span>
            <span>One brand, four native formats</span>
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start pb-2">
          {ordered.map((comp, i) => {
            const p = PLATFORMS[comp.platform];
            const isPlaying = playingId === comp.platform;
            return (
              <motion.div
                key={comp.platform}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: p.brandColor }}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-ink-400">
                    {p.aspect}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setPlayingId(isPlaying ? null : comp.platform)
                  }
                  className={cn(
                    "rounded-xl ring-1 ring-ink-100 hover:ring-signal-400/60 transition-all",
                    isPlaying && "ring-signal-500/80 shadow-[0_20px_40px_-16px_rgba(242,64,22,0.4)]",
                  )}
                >
                  <PlatformFrame
                    composition={comp}
                    persona={persona}
                    voiceAudioUrl={run.assets?.voiceAudioUrl}
                    avatarVideoUrl={run.assets?.avatarVideoUrl}
                    autoplay={isPlaying}
                    compact
                  />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 text-[11px] text-ink-400">
        <span>Click any card to play it.</span>
        <span>
          One strategy ·{" "}
          <span className="text-ink-700 font-medium">four native posts</span>
        </span>
      </div>
    </div>
  );
}
