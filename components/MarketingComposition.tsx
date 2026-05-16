"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { AvatarRenderStatus, BrandPersona, PlatformComposition } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  composition: PlatformComposition;
  persona: BrandPersona;
  voiceAudioUrl?: string;
  /** Real http URL → uses <video>; client://avatar → uses clean brand emblem */
  avatarVideoUrl?: string;
  /** Status of the background HeyGen render — drives the presenter-side loader */
  avatarStatus?: AvatarRenderStatus;
  avatarStatusReason?: string;
  aspect: "9:16" | "16:9" | "1:1";
  autoplay?: boolean;
}

/**
 * Marketing-video split composition.
 *  - One half: animated content (b-roll Ken Burns + brand mark + word-reveal hook + CTA).
 *  - Other half: presenter (real HeyGen video, or a clean brand-emblem fallback).
 *
 * Layout per aspect:
 *  - 16:9 / 1:1 → horizontal split (content left, presenter right)
 *  - 9:16       → vertical split  (content top,  presenter bottom)
 *
 * Playback: one rAF time-tracker drives everything. Click-to-seek on the
 * progress bar. Replay is supported by clicking play once the run ends.
 */
export function MarketingComposition({
  composition,
  persona,
  voiceAudioUrl,
  avatarVideoUrl,
  avatarStatus,
  avatarStatusReason,
  aspect,
  autoplay = false,
}: Props) {
  const layout = aspect === "9:16" ? "vertical" : "horizontal";
  const isMockAvatar = !avatarVideoUrl || avatarVideoUrl.startsWith("client://avatar");
  const useBrowserSpeech =
    !voiceAudioUrl || voiceAudioUrl.startsWith("client://speech");

  const speechText = useMemo(() => {
    if (!voiceAudioUrl || !voiceAudioUrl.startsWith("client://speech")) return "";
    const qs = voiceAudioUrl.split("?")[1] ?? "";
    const t = new URLSearchParams(qs).get("text");
    return t ? decodeURIComponent(t) : "";
  }, [voiceAudioUrl]);

  const totalDuration =
    composition.captions[composition.captions.length - 1]?.end || 12;

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const currentTime = progress * totalDuration;
  const activeCaption = composition.captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end,
  );
  const ended = progress >= 0.999;

  /* ──────── playback control ──────── */

  function stopAll() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) audioRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    startedAtRef.current = null;
    setPlaying(false);
  }

  function tick() {
    if (!startedAtRef.current) return;
    const t = (Date.now() - startedAtRef.current) / 1000;
    const p = Math.min(1, t / totalDuration);
    setProgress(p);
    if (t >= totalDuration) {
      setPlaying(false);
      startedAtRef.current = null;
      // stop video/audio at the end
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function play(fromStart = false) {
    // If the playback already ended, reset to 0 for a clean replay.
    const startProgress = fromStart || ended ? 0 : progress;
    setProgress(startProgress);
    setPlaying(true);
    startedAtRef.current = Date.now() - startProgress * totalDuration * 1000;

    if (!isMockAvatar && videoRef.current) {
      videoRef.current.muted = muted;
      try {
        videoRef.current.currentTime = startProgress * totalDuration;
      } catch {
        /* not seekable yet */
      }
      void videoRef.current.play();
    } else if (voiceAudioUrl && !useBrowserSpeech && audioRef.current) {
      audioRef.current.muted = muted;
      try {
        audioRef.current.currentTime = startProgress * totalDuration;
      } catch {
        /* not seekable yet */
      }
      void audioRef.current.play();
    } else if (useBrowserSpeech && speechText && typeof window !== "undefined") {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speechText);
      u.rate = 1.02;
      u.pitch = 1;
      u.volume = muted ? 0 : 1;
      const voices = synth.getVoices();
      const wanted = persona.voiceGender;
      if (wanted !== "neutral" && voices.length) {
        const hints =
          wanted === "female"
            ? ["female", "samantha", "victoria", "karen", "tessa", "fiona", "ava", "zoe", "joanna", "emma"]
            : ["male", "alex", "daniel", "fred", "tom", "diego", "rishi", "matthew"];
        const pick =
          voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith("en") &&
              hints.some((h) => v.name.toLowerCase().includes(h)),
          ) ?? voices.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
        if (pick) u.voice = pick;
      }
      u.onend = () => {
        setPlaying(false);
        setProgress(1);
        startedAtRef.current = null;
      };
      synth.speak(u);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    stopAll();
  }

  function seekToFraction(frac: number) {
    const clamped = Math.max(0, Math.min(1, frac));
    setProgress(clamped);
    const wasPlaying = playing;
    stopAll();
    // Update the underlying media position even when paused, so the next play resumes from the right place.
    if (!isMockAvatar && videoRef.current) {
      try {
        videoRef.current.currentTime = clamped * totalDuration;
      } catch {
        /* swallow */
      }
    }
    if (voiceAudioUrl && !useBrowserSpeech && audioRef.current) {
      try {
        audioRef.current.currentTime = clamped * totalDuration;
      } catch {
        /* swallow */
      }
    }
    if (wasPlaying) play();
  }

  function onScrubClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = progressBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    seekToFraction(frac);
  }

  useEffect(() => {
    if (autoplay) {
      const t = setTimeout(() => play(true), 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  // Reset on avatar URL change (e.g. hot-swap from mock to real HeyGen video)
  useEffect(() => {
    stopAll();
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarVideoUrl]);

  useEffect(() => stopAll, []);

  /* ──────── render ──────── */

  const containerClass =
    aspect === "9:16"
      ? "aspect-[9/16]"
      : aspect === "16:9"
        ? "aspect-video"
        : "aspect-square";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        containerClass,
      )}
      style={{
        background: `linear-gradient(135deg, ${persona.primaryColor}0F 0%, ${persona.accentColor}1F 100%), #FBFAF7`,
      }}
    >
      {/* Soft brand orbs */}
      <div
        className="absolute -top-12 -left-12 h-48 w-48 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: persona.primaryColor }}
      />
      <div
        className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: persona.accentColor }}
      />

      {/* Split */}
      <div
        className={cn(
          "relative h-full w-full",
          layout === "horizontal" ? "flex" : "flex flex-col",
        )}
      >
        <ContentSide
          composition={composition}
          persona={persona}
          currentTime={currentTime}
          totalDuration={totalDuration}
          layout={layout}
        />

        <PresenterSide
          persona={persona}
          isMockAvatar={isMockAvatar}
          videoUrl={avatarVideoUrl}
          videoRef={videoRef}
          playing={playing}
          layout={layout}
          avatarStatus={avatarStatus}
          avatarStatusReason={avatarStatusReason}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
            startedAtRef.current = null;
          }}
        />
      </div>

      {/* Audio element when we have a real TTS URL (not browser speech) */}
      {voiceAudioUrl && !useBrowserSpeech && (
        <audio
          ref={audioRef}
          src={voiceAudioUrl}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
            startedAtRef.current = null;
          }}
        />
      )}

      {/* Captions */}
      <AnimatePresence>
        {activeCaption && (
          <motion.div
            key={activeCaption.start}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 z-10 px-3 max-w-[90%] pointer-events-none",
              layout === "vertical" ? "bottom-16" : "bottom-14",
            )}
          >
            <span className="inline-block text-center bg-ink-800/85 text-white text-[12px] md:text-[13px] px-3 py-1.5 rounded-md leading-snug font-medium text-balance backdrop-blur-sm">
              {activeCaption.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress + controls */}
      <div className="absolute left-0 right-0 bottom-0 z-20 px-3 pb-2.5 pt-6 bg-gradient-to-t from-ink-900/35 to-transparent">
        <div
          ref={progressBarRef}
          onClick={onScrubClick}
          className="h-1.5 bg-white/30 rounded-full overflow-hidden mb-2 cursor-pointer relative group"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full transition-[width] duration-100 pointer-events-none"
            style={{
              width: `${progress * 100}%`,
              background: persona.primaryColor,
            }}
          />
          {/* Scrubber handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (playing ? pause() : play(ended))}
            className="h-7 w-7 rounded-full bg-white/95 hover:bg-white text-ink-800 flex items-center justify-center transition-colors shadow-sm"
            aria-label={playing ? "Pause" : ended ? "Replay" : "Play"}
          >
            {playing ? (
              <Pause size={12} />
            ) : ended ? (
              <RotateCcw size={11} />
            ) : (
              <Play size={12} className="ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setMuted((m) => !m)}
            className="h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur flex items-center justify-center transition-colors"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <div className="text-[10px] text-white/90 tabular-nums font-medium">
            {fmt(currentTime)} / {fmt(totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ──────────────────────────── Content side ──────────────────────────── */

function ContentSide({
  composition,
  persona,
  currentTime,
  totalDuration,
  layout,
}: {
  composition: PlatformComposition;
  persona: BrandPersona;
  currentTime: number;
  totalDuration: number;
  layout: "horizontal" | "vertical";
}) {
  // Word-by-word color reveal on the hook driven by currentTime.
  // The hook plays through ~40% of the spoken duration.
  const hookWords = composition.copy.hook.split(/\s+/);
  const hookProgress =
    totalDuration > 0 ? currentTime / Math.max(2, totalDuration * 0.4) : 0;
  const showCta = currentTime > totalDuration * 0.65;

  // Pick the b-roll image active at currentTime
  const bRoll = composition.bRoll ?? [];
  const activeBRoll =
    bRoll.find((b) => currentTime >= b.startAt && currentTime <= b.endAt) ??
    bRoll[Math.floor((currentTime / totalDuration) * bRoll.length)] ??
    bRoll[0];
  const bRollIndex = activeBRoll ? bRoll.indexOf(activeBRoll) : -1;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden",
        layout === "horizontal" ? "w-1/2 h-full" : "w-full h-1/2",
        "px-4 md:px-5 py-4",
      )}
    >
      {/* B-roll backdrop — Ken Burns crossfade between beats */}
      {bRoll.length > 0 && activeBRoll && (
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`bg-${bRollIndex}`}
            className="absolute inset-0 z-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{
              opacity: 1,
              scale: 1.14,
              transition: {
                opacity: { duration: 0.55 },
                scale: {
                  duration: Math.max(4, (activeBRoll.endAt - activeBRoll.startAt) * 1.5),
                  ease: "linear",
                },
              },
            }}
            exit={{ opacity: 0, transition: { duration: 0.45 } }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeBRoll.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              // A small blur helps mask any garbled pseudo-text Flux sometimes
              // bakes into the image without killing the visual.
              style={{ filter: "saturate(1.02) contrast(1.02) blur(1.2px)" }}
            />
            {/* Cream wash — tuned to keep the photo visible but mute baked-in artifacts */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(251,250,247,0.65) 0%, rgba(251,250,247,0.45) 50%, rgba(251,250,247,0.75) 100%)",
              }}
            />
            {/* Subtle brand-color tint */}
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{
                background: `linear-gradient(135deg, ${persona.primaryColor}14 0%, transparent 60%)`,
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Brand mark */}
      <div className="flex items-center gap-2 z-[1]">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center text-[14px] ring-1 ring-ink-100/80 shadow-sm bg-white"
          style={{
            background: `linear-gradient(135deg, ${persona.primaryColor}26, ${persona.accentColor}3D)`,
          }}
        >
          {persona.emoji}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-ink-800 leading-none truncate">
            {persona.name}
          </div>
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-500 mt-0.5">
            {persona.industry.split("—")[0].trim().slice(0, 28)}
          </div>
        </div>
      </div>

      {/* Hero hook + scaling underline */}
      <div className={cn("z-[1] relative", layout === "vertical" ? "text-center" : "text-left")}>
        <p
          className={cn(
            "font-display leading-[1.05] text-balance",
            layout === "horizontal" ? "text-[22px] md:text-[26px]" : "text-[22px]",
          )}
        >
          {hookWords.map((w, i) => {
            const wordProgress = (i + 1) / hookWords.length;
            const lit = hookProgress >= wordProgress;
            return (
              <span
                key={i}
                className={cn(
                  "transition-colors duration-300",
                  lit ? "text-ink-800" : "text-ink-500/70",
                )}
              >
                {w}{" "}
              </span>
            );
          })}
        </p>
        <div
          className="mt-2 h-[3px] rounded-full origin-left transition-transform duration-200"
          style={{
            background: persona.primaryColor,
            transform: `scaleX(${Math.min(1, currentTime / Math.max(1, totalDuration))})`,
            width: layout === "horizontal" ? "60%" : "40%",
            margin: layout === "vertical" ? "8px auto 0" : undefined,
          }}
        />
      </div>

      {/* CTA — appears in the last third */}
      <div className="z-[1] min-h-[44px]">
        <AnimatePresence>
          {showCta && (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "rounded-lg px-3 py-2 inline-flex items-center gap-2 max-w-full",
                "bg-white border border-ink-100 shadow-sm",
                layout === "vertical" ? "mx-auto" : "",
              )}
              style={{ boxShadow: `0 8px 24px -12px ${persona.primaryColor}40` }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: persona.primaryColor }}
              />
              <span className="text-[11px] font-medium text-ink-800 truncate">
                {composition.copy.cta}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ──────────────────────────── Presenter side ──────────────────────────── */

function PresenterSide({
  persona,
  isMockAvatar,
  videoUrl,
  videoRef,
  playing,
  layout,
  avatarStatus,
  avatarStatusReason,
  onEnded,
}: {
  persona: BrandPersona;
  isMockAvatar: boolean;
  videoUrl: string | undefined;
  videoRef: React.RefObject<HTMLVideoElement>;
  playing: boolean;
  layout: "horizontal" | "vertical";
  avatarStatus?: AvatarRenderStatus;
  avatarStatusReason?: string;
  onEnded: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink-800",
        layout === "horizontal" ? "w-1/2 h-full" : "w-full h-1/2",
      )}
    >
      {/* Real video — fills the whole presenter side edge-to-edge */}
      {!isMockAvatar && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          preload="metadata"
          onEnded={onEnded}
        />
      )}

      {/* Clean brand-emblem fallback (no cartoon, no hardcoded text) */}
      {isMockAvatar && (
        <BrandEmblem
          persona={persona}
          playing={playing}
          avatarStatus={avatarStatus}
          avatarStatusReason={avatarStatusReason}
        />
      )}
    </div>
  );
}

/* ──────────────────────────── Brand emblem (avatar fallback) ──────────────────────────── */

function BrandEmblem({
  persona,
  playing,
  avatarStatus,
  avatarStatusReason,
}: {
  persona: BrandPersona;
  playing: boolean;
  avatarStatus?: AvatarRenderStatus;
  avatarStatusReason?: string;
}) {
  const pc = persona.primaryColor;
  const ac = persona.accentColor;
  const isRendering = avatarStatus === "rendering";
  const isFailed = avatarStatus === "failed";
  return (
    <div className="absolute inset-0">
      {/* Layered radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(80% 80% at 50% 35%, ${pc}55 0%, ${pc}22 35%, transparent 75%), linear-gradient(180deg, #0a0e14 0%, #161313 100%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(30% 30% at 30% 30%, ${ac}66, transparent 80%)`,
        }}
      />

      {/* Top-left status pill — loader / failed / ready */}
      {avatarStatus && avatarStatus !== "ready" && (
        <div className="absolute top-2 left-2 right-2 z-20 flex">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] font-semibold backdrop-blur-sm border max-w-full",
              isRendering &&
                "bg-white/15 border-white/20 text-white",
              isFailed &&
                "bg-amber-500/20 border-amber-200/40 text-amber-100",
              avatarStatus === "unavailable" &&
                "bg-white/10 border-white/15 text-white/70",
            )}
            title={avatarStatusReason}
          >
            {isRendering && <Loader2 size={10} className="animate-spin" />}
            {isFailed && <AlertCircle size={10} />}
            <span className="truncate">
              {isRendering
                ? "Rendering avatar"
                : isFailed
                  ? "HeyGen credits needed"
                  : "Brand emblem"}
            </span>
          </div>
        </div>
      )}

      {/* Pulsing rings while talking */}
      {playing && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-44 w-44 rounded-full border border-white/12 animate-pulse-ring" />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div
              className="h-36 w-36 rounded-full border animate-pulse-ring"
              style={{ borderColor: `${pc}55`, animationDelay: "300ms" }}
            />
          </div>
        </>
      )}

      {/* Brand wordmark + emoji emblem */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <div
          className="h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
          style={{
            background: `linear-gradient(135deg, ${pc} 0%, ${ac} 100%)`,
          }}
        >
          {persona.emoji}
        </div>
        <div className="mt-3 font-display text-[18px] md:text-[20px] text-white leading-tight">
          {persona.name}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/55">
          {persona.industry.split("—")[0].trim().slice(0, 22)}
        </div>

        {/* Audio waveform-ish indicator while talking */}
        {playing && (
          <div className="mt-4 flex items-end gap-1 h-5">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white/85"
                style={{
                  animation: `marketing-bar 900ms ease-in-out infinite`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes marketing-bar {
          0%, 100% {
            height: 6px;
          }
          50% {
            height: 18px;
          }
        }
      `}</style>
    </div>
  );
}
