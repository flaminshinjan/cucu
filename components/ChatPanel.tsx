"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { BrandPersona } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  examples: Array<{ label: string; text: string }>;
  derivedPersona?: BrandPersona;
  running: boolean;
  hasResult: boolean;
  onRun: (message: string) => void;
  onReset: () => void;
  capabilities: {
    hasAnthropic: boolean;
    hasTavily: boolean;
    hasTTS: boolean;
    hasAvatar: boolean;
    hasReplicate: boolean;
    hasSupabase: boolean;
  } | null;
}

const CAP_LABELS: Record<keyof Props["capabilities"] & string, string> = {
  hasAnthropic: "Claude",
  hasTavily: "Tavily",
  hasTTS: "Voice",
  hasAvatar: "Avatar",
  hasReplicate: "Images",
  hasSupabase: "Supabase",
};

export function ChatPanel({
  examples,
  derivedPersona,
  running,
  hasResult,
  onRun,
  onReset,
  capabilities,
}: Props) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to a cap
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(180, el.scrollHeight) + "px";
  }, [message]);

  function submit() {
    const m = message.trim();
    if (!m || running) return;
    onRun(m);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const showInput = !running && !hasResult;
  const showDerived = !!derivedPersona;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display text-xl text-ink-800 leading-none">
            Brief
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            01
          </span>
        </div>
        <p className="text-xs text-ink-500">
          Tell cucu what to make. Plain English, a URL, a topic — anything.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 -mr-1 flex flex-col gap-3">
        {/* Derived persona card — appears once the agent has parsed the brief */}
        <AnimatePresence>
          {showDerived && derivedPersona && (
            <motion.div
              key={derivedPersona.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-ink-200 bg-white p-4 relative overflow-hidden"
            >
              <div
                className="absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
                style={{
                  background: `radial-gradient(closest-side, ${derivedPersona.primaryColor}, transparent)`,
                }}
              />
              <div className="relative flex items-start gap-3">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ring-1 ring-ink-100"
                  style={{
                    background: `linear-gradient(135deg, ${derivedPersona.primaryColor}22, ${derivedPersona.accentColor}38)`,
                  }}
                >
                  {derivedPersona.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-display text-lg text-ink-800 leading-none">
                      {derivedPersona.name}
                    </h3>
                    <Badge variant="secondary">Derived</Badge>
                  </div>
                  <p className="text-[12px] text-ink-600 leading-snug">
                    {derivedPersona.tagline}
                  </p>
                  <div className="text-[10.5px] text-ink-400 mt-1.5 leading-snug">
                    {derivedPersona.industry}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {derivedPersona.voiceAttributes.slice(0, 4).map((v) => (
                      <span
                        key={v}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-ink-600 border border-ink-100"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Either the input area, or the running/post-run state */}
        {showInput && (
          <>
            <div className="rounded-2xl border border-ink-100 bg-white relative overflow-hidden">
              <Textarea
                ref={textareaRef}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKey}
                placeholder="A B2B SaaS for product analytics, called Lumen. Direct, numbers-first. Audience: heads of growth at Series-A SaaS."
                className="w-full border-0 bg-transparent text-[13.5px] leading-relaxed text-ink-800 placeholder:text-ink-300 focus-visible:ring-0 focus-visible:border-0 px-4 pt-4 pb-12"
                style={{ minHeight: "120px" }}
              />
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] text-ink-300">
                  ⌘ + Enter
                </span>
                <button
                  onClick={submit}
                  disabled={!message.trim()}
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                    message.trim()
                      ? "bg-ink-800 text-cream-50 hover:bg-ink-700"
                      : "bg-ink-100 text-ink-300 cursor-not-allowed",
                  )}
                  aria-label="Run"
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 px-1">
                Try one
              </div>
              {examples.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setMessage(ex.text)}
                  disabled={running}
                  className="text-left rounded-xl border border-ink-100 bg-white/70 hover:bg-white hover:border-ink-300 px-3 py-2.5 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-ink-800 truncate">
                      {ex.label}
                    </span>
                    <Sparkles
                      size={11}
                      className="text-ink-300 group-hover:text-signal-500 transition-colors shrink-0"
                    />
                  </div>
                  <p className="text-[10.5px] text-ink-400 mt-0.5 line-clamp-2 leading-snug">
                    {ex.text}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {(running || hasResult) && (
          <div className="rounded-xl border border-ink-100 bg-cream-100/60 p-3.5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5">
              Operator brief
            </div>
            <p className="text-[12px] text-ink-700 leading-snug">
              <BriefMessage />
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 shrink-0">
        {running ? (
          <Button
            variant="outline"
            size="lg"
            disabled
            className="w-full rounded-xl font-semibold"
          >
            <Loader2 size={16} className="animate-spin" />
            cucu is working…
          </Button>
        ) : hasResult ? (
          <Button
            variant="coral"
            size="lg"
            onClick={onReset}
            className="w-full rounded-xl font-semibold"
          >
            <RotateCcw size={15} />
            Start a new run
          </Button>
        ) : (
          <Button
            variant="coral"
            size="lg"
            onClick={submit}
            disabled={!message.trim()}
            className="w-full rounded-xl font-semibold"
          >
            <Sparkles size={15} />
            Run cucu
          </Button>
        )}

        {capabilities && <CapabilityStrip capabilities={capabilities} />}
      </div>
    </div>
  );

  // Inline so it can pull the latest message after running.
  function BriefMessage() {
    return <>{message || derivedPersona?.tagline || "(brief sent)"}</>;
  }
}

function CapabilityStrip({
  capabilities,
}: {
  capabilities: NonNullable<Props["capabilities"]>;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-cream-100/60 p-2.5">
      <div className="flex items-center justify-between flex-wrap gap-1">
        {Object.entries(capabilities).map(([key, on]) => (
          <div key={key} className="flex items-center gap-1 text-[10px] text-ink-500">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                on
                  ? "bg-signal-500 shadow-[0_0_6px_rgba(242,64,22,0.45)]"
                  : "bg-ink-200",
              )}
            />
            <span className={cn("font-medium", on ? "text-ink-700" : "text-ink-400")}>
              {CAP_LABELS[key as keyof typeof CAP_LABELS]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
