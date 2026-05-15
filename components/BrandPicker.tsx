"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Globe, Loader2, Sparkles, Target } from "lucide-react";
import type { BrandPersona, CustomBrief, RunStage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  personas: BrandPersona[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun: (brief?: CustomBrief) => void;
  stage: RunStage;
  running: boolean;
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

export function BrandPicker({
  personas,
  selectedId,
  onSelect,
  onRun,
  running,
  capabilities,
}: Props) {
  const [briefOpen, setBriefOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [focus, setFocus] = useState("");
  const [audience, setAudience] = useState("");

  function handleRun() {
    const brief: CustomBrief | undefined =
      url.trim() || focus.trim() || audience.trim()
        ? {
            url: url.trim() || undefined,
            focus: focus.trim() || undefined,
            audience: audience.trim() || undefined,
          }
        : undefined;
    onRun(brief);
  }

  const briefActive = !!(url.trim() || focus.trim() || audience.trim());

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display text-xl text-ink-800 leading-none">
            Brand
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            01
          </span>
        </div>
        <p className="text-xs text-ink-500">
          Pick a brand, or open the brief panel for a custom run.
        </p>
      </div>

      {/* Personas list + Brief panel share one inner scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 -mr-1 flex flex-col gap-2.5">
        {personas.map((p) => {
          const selected = selectedId === p.id;
          return (
            <motion.button
              key={p.id}
              onClick={() => onSelect(p.id)}
              disabled={running}
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              className={cn(
                "text-left rounded-xl p-3.5 transition-all border",
                selected
                  ? "border-ink-800 bg-white shadow-[0_8px_24px_-12px_rgba(30,12,10,0.18)]"
                  : "border-ink-100 bg-white/70 hover:border-ink-300 hover:bg-white",
                running && "opacity-60 cursor-not-allowed",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center h-10 w-10 rounded-xl text-xl shrink-0 ring-1 ring-ink-100"
                  style={{
                    background: `linear-gradient(135deg, ${p.primaryColor}1A, ${p.accentColor}2A)`,
                  }}
                >
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink-800 truncate">
                      {p.name}
                    </h3>
                    {selected && (
                      <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-signal-500" />
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-500 mt-0.5 line-clamp-2 leading-snug">
                    {p.tagline}
                  </p>
                  <div className="text-[10px] text-ink-400 mt-1.5 leading-relaxed">
                    {p.industry}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* Custom brief — collapsible. Overrides persona research when filled. */}
        <div
          className={cn(
            "rounded-xl border overflow-hidden transition-colors",
            briefActive ? "border-signal-300 bg-signal-50/40" : "border-ink-100 bg-white/70",
          )}
        >
          <button
            onClick={() => setBriefOpen((v) => !v)}
            disabled={running}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left",
              "hover:bg-white transition-colors",
              running && "opacity-60 cursor-not-allowed",
            )}
            type="button"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  briefActive
                    ? "bg-signal-500 text-white"
                    : "bg-cream-100 text-ink-500 border border-ink-100",
                )}
              >
                <Target size={12} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold flex items-center gap-1.5 text-ink-800">
                  Custom brief
                  {briefActive && <Badge variant="default">Active</Badge>}
                </div>
                <div className="text-[10.5px] text-ink-400 truncate">
                  Point cucu at a URL or topic
                </div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                "text-ink-400 transition-transform shrink-0",
                briefOpen && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {briefOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 pt-1 space-y-3 border-t border-ink-100">
                  <Field
                    label={
                      <span className="flex items-center gap-1.5">
                        <Globe size={10} /> Brand website
                      </span>
                    }
                  >
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://stripe.com"
                      disabled={running}
                    />
                  </Field>
                  <Field label="What to research">
                    <Textarea
                      rows={3}
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      placeholder="Cross-border payments for SMBs in SEA — competitive angles and underserved use cases"
                      disabled={running}
                    />
                  </Field>
                  <Field label="Target audience (optional)">
                    <Input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Operators at $1–10M ARR SaaS companies"
                      disabled={running}
                    />
                  </Field>
                  <div className="text-[10.5px] text-ink-400 leading-snug">
                    The persona above drives voice and visuals; this brief
                    redirects what cucu researches and writes about.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 shrink-0">
        <Button
          variant="coral"
          size="lg"
          onClick={handleRun}
          disabled={!selectedId || running}
          className="w-full text-[15px] font-semibold tracking-tight rounded-xl"
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              cucu is working…
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {briefActive ? "Run on custom brief" : "Run cucu"}
            </>
          )}
        </Button>

        {capabilities && <CapabilityStrip capabilities={capabilities} />}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-400 mb-1">
        {label}
      </div>
      {children}
    </div>
  );
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
          <div
            key={key}
            className="flex items-center gap-1 text-[10px] text-ink-500"
          >
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
