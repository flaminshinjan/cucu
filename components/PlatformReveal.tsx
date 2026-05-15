"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Volume2, VolumeX, Sparkles } from "lucide-react";
import type { BrandPersona, ContentRun } from "@/lib/types";
import { PlatformFrame } from "@/components/PlatformFrame";
import { PLATFORM_ORDER, PLATFORMS } from "@/lib/platforms";

interface Props {
  open: boolean;
  onClose: () => void;
  persona: BrandPersona;
  run: Partial<ContentRun>;
}

export function PlatformReveal({ open, onClose, persona, run }: Props) {
  const [phase, setPhase] = useState<"intro" | "grid">("intro");
  const [mutedExceptIndex, setMutedExceptIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("intro");
      const t = setTimeout(() => setPhase("grid"), 1400);
      return () => clearTimeout(t);
    }
    setPhase("intro");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const compositions = run.compositions ?? [];
  const ordered = PLATFORM_ORDER.map((id) => compositions.find((c) => c.platform === id)).filter(
    (c): c is NonNullable<typeof c> => !!c,
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cream-100/95 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white border border-ink-200 hover:bg-cream-200 flex items-center justify-center text-ink-700 shadow-sm z-10"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="absolute inset-0 pointer-events-none grid-bg opacity-50" />

          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <motion.div
                key="intro"
                className="relative text-center"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-signal-100 border border-signal-200 text-signal-700 text-[11px] uppercase tracking-[0.18em] mb-5"
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <Sparkles size={12} />
                  Four-platform reveal
                </motion.div>
                <motion.h2
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="font-display text-4xl md:text-6xl text-balance text-ink-800 leading-[1.05]"
                >
                  Same brand. <span className="italic text-signal-600">Four</span> native formats.
                </motion.h2>
                <motion.p
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-ink-500 mt-3 max-w-xl mx-auto text-sm"
                >
                  Researched, strategized, written, voiced and composed in under three minutes.
                </motion.p>
              </motion.div>
            )}

            {phase === "grid" && (
              <motion.div
                key="grid"
                className="relative w-full max-w-7xl px-6 py-10"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-signal-600 mb-1">
                      {persona.name}
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl text-balance text-ink-800 leading-tight">
                      {run.strategy?.hero.angle}
                    </h2>
                  </div>
                  <div className="text-xs text-ink-500 hidden md:block max-w-xs text-right">
                    Click the speaker on a card to hear it. Each frame in its native aspect ratio.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
                  {ordered.map((comp, i) => {
                    const p = PLATFORMS[comp.platform];
                    return (
                      <motion.div
                        key={comp.platform}
                        initial={{ opacity: 0, y: 30, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          delay: 0.12 * i,
                          duration: 0.65,
                          ease: [0.2, 0.8, 0.2, 1],
                        }}
                        className="flex flex-col gap-2 group"
                      >
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: p.brandColor }}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
                              {p.name} · {p.aspect}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setMutedExceptIndex(mutedExceptIndex === i ? null : i)
                            }
                            className="text-ink-400 hover:text-ink-700"
                          >
                            {mutedExceptIndex === i ? (
                              <Volume2 size={12} />
                            ) : (
                              <VolumeX size={12} />
                            )}
                          </button>
                        </div>

                        <div className="rounded-xl ring-1 ring-ink-100 group-hover:ring-signal-400/60 transition-shadow shadow-[0_30px_60px_-20px_rgba(30,12,10,0.18)]">
                          <PlatformFrame
                            composition={comp}
                            persona={persona}
                            voiceAudioUrl={run.assets?.voiceAudioUrl}
                            avatarVideoUrl={run.assets?.avatarVideoUrl}
                            autoplay={mutedExceptIndex === i}
                            compact
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-8 text-center text-xs text-ink-500"
                >
                  One brand, one strategy, one hero script —{" "}
                  <span className="text-ink-800 font-medium">four native posts</span>, scripted and composed by cucu.
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
