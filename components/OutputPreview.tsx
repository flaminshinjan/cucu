"use client";

import { motion } from "framer-motion";
import { Sparkles, FileText, Compass, Megaphone, Eye } from "lucide-react";
import type {
  BrandPersona,
  ContentRun,
  ResearchOutput,
  StrategyOutput,
} from "@/lib/types";
import { PLATFORMS, PLATFORM_ORDER } from "@/lib/platforms";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformFrame } from "@/components/PlatformFrame";
import { cn } from "@/lib/utils";

interface Props {
  persona: BrandPersona | null;
  run: Partial<ContentRun>;
  stage: ContentRun["stage"];
  onReveal: () => void;
  revealReady: boolean;
}

export function OutputPreview({ persona, run, stage, onReveal, revealReady }: Props) {
  if (!persona && !run.research) {
    return <EmptyState />;
  }

  const sections = [
    { id: "research", label: "Research", icon: Compass, ready: !!run.research },
    { id: "strategy", label: "Strategy", icon: FileText, ready: !!run.strategy },
    { id: "copy", label: "Copy", icon: Megaphone, ready: !!run.copies && run.copies.length > 0 },
    { id: "compose", label: "Compose", icon: Eye, ready: !!run.compositions && run.compositions.length > 0 },
  ] as const;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-display text-xl text-ink-800 leading-none">
                Output
              </h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 ml-2">
                03
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-500">
              {persona ? (
                <>
                  <span
                    className="h-5 w-5 rounded-md flex items-center justify-center text-[13px] ring-1 ring-ink-100"
                    style={{
                      background: `linear-gradient(135deg, ${persona.primaryColor}1A, ${persona.accentColor}2A)`,
                    }}
                  >
                    {persona.emoji}
                  </span>
                  <span className="text-ink-700 font-medium truncate">{persona.name}</span>
                </>
              ) : (
                <span>Waiting for brand derivation…</span>
              )}
            </div>
          </div>

          <Button
            variant={revealReady ? "coral" : "outline"}
            size="sm"
            onClick={onReveal}
            disabled={!revealReady}
            className={cn(
              "rounded-full font-semibold tracking-tight shrink-0 transition-all",
              !revealReady && "opacity-60",
            )}
          >
            <Sparkles size={13} />
            Reveal all 4
          </Button>
        </div>
      </div>

      <Tabs defaultValue="research" className="flex-1 flex flex-col min-h-0 gap-3">
        <TabsList className="w-fit shrink-0">
          {sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
              <s.icon size={11} />
              {s.label}
              {s.ready && <span className="h-1 w-1 rounded-full bg-signal-500" />}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="research" className="flex-1 min-h-0 mt-0">
          <ResearchView research={run.research} stage={stage} />
        </TabsContent>
        <TabsContent value="strategy" className="flex-1 min-h-0 mt-0">
          <StrategyView strategy={run.strategy} stage={stage} />
        </TabsContent>
        <TabsContent value="copy" className="flex-1 min-h-0 mt-0">
          <CopyView run={run} stage={stage} />
        </TabsContent>
        <TabsContent value="compose" className="flex-1 min-h-0 mt-0">
          <ComposeView run={run} persona={persona} stage={stage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <span className="font-display text-[14rem] leading-none text-ink-100 select-none">
        c
      </span>
      <p className="font-display text-2xl text-ink-700 -mt-12">
        Tell cucu what to make.
      </p>
      <p className="text-xs text-ink-400 mt-2 max-w-[22rem] text-balance">
        cucu researches a niche, designs a content strategy, writes platform
        drafts, voices them and renders an AI avatar — all in this column,
        streamed live.
      </p>
    </div>
  );
}

function ResearchView({
  research,
  stage,
}: {
  research: ResearchOutput | undefined;
  stage: ContentRun["stage"];
}) {
  if (!research)
    return <Skeleton lines={5} label="Pulling sources" active={stage === "researching"} />;
  return (
    <div className="space-y-5 overflow-y-auto scrollbar-thin pr-1 h-full">
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-xl text-ink-800 leading-snug text-balance"
      >
        {research.summary}
      </motion.p>

      <section>
        <SectionLabel>Top angles</SectionLabel>
        <div className="grid gap-1.5">
          {research.topAngles.map((a, i) => (
            <motion.div
              key={a}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-sm bg-white border border-ink-100 rounded-lg px-3 py-2 text-ink-800"
            >
              <span className="font-display text-signal-600 mr-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              {a}
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Findings · {research.findings.length}</SectionLabel>
        <div className="grid gap-2">
          {research.findings.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="text-xs bg-white border border-ink-100 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant={
                    f.signal === "trend"
                      ? "default"
                      : f.signal === "pain-point"
                        ? "warning"
                        : f.signal === "competitor"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {f.signal}
                </Badge>
                <div className="font-semibold text-ink-800 leading-snug">{f.topic}</div>
              </div>
              <p className="text-ink-500 leading-relaxed">{f.why}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StrategyView({
  strategy,
  stage,
}: {
  strategy: StrategyOutput | undefined;
  stage: ContentRun["stage"];
}) {
  if (!strategy)
    return (
      <Skeleton lines={6} label="Composing pillars, plan, and hero angle" active={stage === "strategizing"} />
    );
  return (
    <div className="space-y-5 overflow-y-auto scrollbar-thin pr-1 h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-ink-200 bg-cream-50 p-5 relative overflow-hidden"
      >
        <div className="absolute -top-8 -right-8 font-display text-[10rem] text-signal-100 leading-none select-none">
          ✦
        </div>
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.18em] text-signal-700 mb-2">
            Hero angle
          </div>
          <div className="font-display text-2xl text-ink-800 leading-tight text-balance">
            <span className="ink-underline">{strategy.hero.angle}</span>
          </div>
          <p className="text-xs text-ink-500 mt-2 leading-relaxed max-w-md">
            {strategy.hero.hypothesis}
          </p>
          <Badge variant="ink" className="mt-3">
            Pillar · {strategy.hero.pillar}
          </Badge>
        </div>
      </motion.div>

      <section>
        <SectionLabel>Pillars</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-3">
          {strategy.pillars.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-ink-100 bg-white p-3"
            >
              <div className="text-xs font-semibold mb-1 text-ink-800">{p.name}</div>
              <p className="text-[11px] text-ink-500 leading-snug">{p.rationale}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Weekly plan</SectionLabel>
        <div className="rounded-xl border border-ink-100 overflow-hidden bg-white">
          {strategy.weeklyPlan.map((d, i) => (
            <div
              key={d.day}
              className={cn(
                "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 text-xs px-3 py-2.5",
                i > 0 && "border-t border-ink-100",
              )}
            >
              <span className="font-mono text-ink-400 uppercase tracking-wider text-[10px]">
                {d.day}
              </span>
              <div className="min-w-0">
                <div className="text-ink-800 truncate">{d.hook}</div>
                <div className="text-[10px] text-ink-400 truncate">{d.pillar}</div>
              </div>
              <Badge variant="outline">{d.format}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CopyView({
  run,
  stage,
}: {
  run: Partial<ContentRun>;
  stage: ContentRun["stage"];
}) {
  const copies = run.copies ?? [];
  if (copies.length === 0)
    return <Skeleton lines={6} label="Four copywriters drafting in parallel" active={stage === "writing"} />;

  return (
    <Tabs defaultValue={PLATFORM_ORDER[0]} className="flex-1 flex flex-col min-h-0 h-full gap-3">
      <TabsList className="shrink-0">
        {PLATFORM_ORDER.map((id) => {
          const p = PLATFORMS[id];
          const ready = copies.some((c) => c.platform === id);
          return (
            <TabsTrigger key={id} value={id} className="gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: p.brandColor }}
              />
              {p.shortName}
              {ready && <span className="h-1 w-1 rounded-full bg-signal-500" />}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {PLATFORM_ORDER.map((id) => {
        const p = PLATFORMS[id];
        const copy = copies.find((c) => c.platform === id);
        return (
          <TabsContent
            key={id}
            value={id}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 mt-0"
          >
            {!copy ? (
              <Skeleton lines={3} label={`Drafting ${p.name}`} active />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{
                      borderColor: p.brandColor + "55",
                      color: p.brandColor,
                      background: p.brandColor + "0F",
                    }}
                  >
                    {p.name}
                  </Badge>
                  <span className="text-[11px] text-ink-400">
                    {copy.meta.characterCount} chars · ~{copy.meta.estimatedReadSeconds}s read
                  </span>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-ink-100 bg-white p-4 space-y-4"
                >
                  <div>
                    <SectionLabel>Hook</SectionLabel>
                    <div className="font-display text-xl text-ink-800 leading-snug text-balance">
                      {copy.hook}
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Body</SectionLabel>
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-ink-700">
                      {copy.body}
                    </pre>
                  </div>
                  <div>
                    <SectionLabel>Call to action</SectionLabel>
                    <div className="text-sm text-ink-800">{copy.cta}</div>
                  </div>
                  {copy.hashtags && copy.hashtags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {copy.hashtags.map((h) => (
                        <span
                          key={h}
                          className="text-[11px] text-signal-700 bg-signal-50 border border-signal-200 rounded-full px-2 py-0.5"
                        >
                          {h.startsWith("#") ? h : `#${h}`}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function ComposeView({
  run,
  persona,
  stage,
}: {
  run: Partial<ContentRun>;
  persona: BrandPersona | null;
  stage: ContentRun["stage"];
}) {
  const compositions = run.compositions ?? [];
  if (compositions.length === 0 || !persona) {
    return (
      <Skeleton
        lines={4}
        label="Voicing and rendering"
        active={stage === "voicing" || stage === "rendering" || stage === "composing"}
      />
    );
  }

  const featured = compositions.find((c) => c.platform === "youtube") ?? compositions[0];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between text-[11px] text-ink-500 shrink-0">
        <div>
          Featured · <span className="text-ink-800 font-medium">{PLATFORMS[featured.platform].name}</span>
        </div>
        <div className="text-ink-400">
          Hit <span className="text-signal-600 font-medium">Reveal all 4</span> for the full reveal
        </div>
      </div>

      <div className="flex-1 min-h-0 grid place-items-center overflow-hidden">
        <div className="w-full max-w-sm max-h-full">
          <PlatformFrame
            composition={featured}
            persona={persona}
            voiceAudioUrl={run.assets?.voiceAudioUrl}
            avatarVideoUrl={run.assets?.avatarVideoUrl}
            autoplay={false}
          />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-2">
      {children}
    </div>
  );
}

function Skeleton({
  lines,
  label,
  active,
}: {
  lines: number;
  label: string;
  active: boolean;
}) {
  return (
    <div className="space-y-3 h-full">
      <div className="text-xs text-ink-500 flex items-center gap-2">
        {active && <span className="h-1.5 w-1.5 rounded-full bg-signal-500 animate-pulse" />}
        {label}
        {active && <span className="text-signal-600 animate-pulse">…</span>}
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 rounded-md bg-cream-100 border border-ink-100",
              active && "shimmer",
            )}
            style={{ width: `${75 + Math.sin(i) * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}
