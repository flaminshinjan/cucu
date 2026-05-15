"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { BrandPersona, PlatformComposition } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  composition: PlatformComposition;
  persona: BrandPersona;
  voiceAudioUrl?: string;
  /** Real http URL → uses <video>; client://avatar → uses mock SVG */
  avatarVideoUrl?: string;
  aspect: "9:16" | "16:9" | "1:1";
  autoplay?: boolean;
}

/**
 * Marketing-video-style split composition:
 *   - One half: animated content (hero angle, brand mark, live caption highlight)
 *   - Other half: presenter (real HeyGen video or mock SVG avatar)
 *
 * Layout adapts per aspect:
 *   - 16:9 / 1:1 → horizontal split (content left, presenter right)
 *   - 9:16        → vertical split  (content top,  presenter bottom)
 *
 * Playback is self-contained: one audio element drives the timer; the
 * video tag stays in sync via the rAF time tracker.
 */
export function MarketingComposition({
  composition,
  persona,
  voiceAudioUrl,
  avatarVideoUrl,
  aspect,
  autoplay = false,
}: Props) {
  const layout = aspect === "9:16" ? "vertical" : "horizontal";
  const isMockAvatar = !avatarVideoUrl || avatarVideoUrl.startsWith("client://avatar");
  const useBrowserSpeech =
    !voiceAudioUrl || voiceAudioUrl.startsWith("client://speech");
  const speechText = useMemo(() => {
    if (!voiceAudioUrl || !voiceAudioUrl.startsWith("client://speech")) return "";
    const params = voiceAudioUrl.split("?")[1] ?? "";
    const t = new URLSearchParams(params).get("text");
    return t ? decodeURIComponent(t) : "";
  }, [voiceAudioUrl]);

  const totalDuration =
    composition.captions[composition.captions.length - 1]?.end || 12;

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const currentTime = progress * totalDuration;
  const activeCaption = composition.captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end,
  );

  // ───── playback control ─────

  function stopEverything() {
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
      setProgress(1);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function play() {
    setPlaying(true);
    startedAtRef.current = Date.now() - progress * totalDuration * 1000;

    if (!isMockAvatar && videoRef.current) {
      videoRef.current.muted = muted;
      void videoRef.current.play();
    } else if (voiceAudioUrl && !useBrowserSpeech && audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.currentTime = progress * totalDuration;
      void audioRef.current.play();
    } else if (useBrowserSpeech && speechText && typeof window !== "undefined") {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speechText);
      u.rate = 1.02;
      u.pitch = 1;
      u.volume = muted ? 0 : 1;
      // Try to pick a gender-matching voice
      const voices = synth.getVoices();
      const wanted = persona.voiceGender;
      if (wanted !== "neutral" && voices.length) {
        const hints =
          wanted === "female"
            ? ["female", "samantha", "victoria", "karen", "tessa", "fiona", "ava", "zoe", "joanna", "emma"]
            : ["male", "alex", "daniel", "fred", "tom", "diego", "rishi", "matthew"];
        const pick =
          voices.find((v) => v.lang.toLowerCase().startsWith("en") && hints.some((h) => v.name.toLowerCase().includes(h))) ??
          voices.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
        if (pick) u.voice = pick;
      }
      utterRef.current = u;
      u.onend = () => {
        setPlaying(false);
        setProgress(1);
      };
      synth.speak(u);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    stopEverything();
  }

  useEffect(() => {
    if (autoplay) {
      const t = setTimeout(() => play(), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, avatarVideoUrl, voiceAudioUrl]);

  // Reset on URL change (e.g. avatar hot-swap)
  useEffect(() => {
    stopEverything();
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarVideoUrl]);

  useEffect(() => stopEverything, []);

  // ───── render ─────

  const containerClass =
    aspect === "9:16"
      ? "aspect-[9/16]"
      : aspect === "16:9"
        ? "aspect-video"
        : "aspect-square";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-ink-100",
        containerClass,
      )}
      style={{
        background: `linear-gradient(135deg, ${persona.primaryColor}10 0%, ${persona.accentColor}1A 100%), #FBFAF7`,
      }}
    >
      {/* Soft brand orbs in the background */}
      <div
        className="absolute -top-12 -left-12 h-48 w-48 rounded-full opacity-35 blur-3xl"
        style={{ background: persona.primaryColor }}
      />
      <div
        className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: persona.accentColor }}
      />

      {/* Split */}
      <div
        className={cn(
          "relative h-full w-full",
          layout === "horizontal" ? "flex" : "flex flex-col",
        )}
      >
        {/* Content side */}
        <ContentSide
          composition={composition}
          persona={persona}
          currentTime={currentTime}
          totalDuration={totalDuration}
          activeCaption={activeCaption}
          layout={layout}
        />

        {/* Presenter side */}
        <PresenterSide
          persona={persona}
          isMockAvatar={isMockAvatar}
          videoUrl={avatarVideoUrl}
          videoRef={videoRef}
          playing={playing}
          layout={layout}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
          }}
        />
      </div>

      {/* Audio (only when we have a real audio URL — video has its own audio) */}
      {voiceAudioUrl && !useBrowserSpeech && (
        <audio
          ref={audioRef}
          src={voiceAudioUrl}
          onEnded={() => {
            setPlaying(false);
            setProgress(1);
          }}
        />
      )}

      {/* Captions — overlay across the bottom of the whole frame */}
      <AnimatePresence>
        {activeCaption && (
          <motion.div
            key={activeCaption.start}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 z-10 px-3 max-w-[88%]",
              layout === "vertical" ? "bottom-14" : "bottom-12",
            )}
          >
            <span className="inline-block text-center bg-ink-800/85 text-white text-[12px] md:text-[13px] px-3 py-1.5 rounded-md leading-snug font-medium text-balance backdrop-blur-sm">
              {activeCaption.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress + controls */}
      <div className="absolute left-0 right-0 bottom-0 z-10 px-3 pb-2.5 pt-6 bg-gradient-to-t from-ink-900/35 to-transparent">
        <div className="h-0.5 bg-white/30 rounded-full overflow-hidden mb-2">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${progress * 100}%`,
              background: persona.primaryColor,
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (playing ? pause() : play())}
            className="h-7 w-7 rounded-full bg-white/95 hover:bg-white text-ink-800 flex items-center justify-center transition-colors shadow-sm"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
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
  const r = Math.round(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ───────────────────────── Content side ───────────────────────── */

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
  activeCaption: PlatformComposition["captions"][number] | undefined;
  layout: "horizontal" | "vertical";
}) {
  // Word-by-word highlight on the hook driven by currentTime
  const hookWords = composition.copy.hook.split(/\s+/);
  const hookProgress = totalDuration > 0 ? currentTime / Math.max(2, totalDuration * 0.4) : 0;
  // Show CTA after the first 60% of the video
  const showCta = currentTime > totalDuration * 0.65;

  // Pick the b-roll image active at currentTime
  const activeBRoll = composition.bRoll?.find(
    (b) => currentTime >= b.startAt && currentTime <= b.endAt,
  ) ?? composition.bRoll?.[0];
  const bRollIndex = activeBRoll
    ? (composition.bRoll ?? []).indexOf(activeBRoll)
    : -1;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden",
        layout === "horizontal" ? "w-1/2 h-full" : "w-full h-[58%]",
        "px-4 md:px-5 py-4",
      )}
    >
      {/* B-roll backdrop — Ken Burns animated, crossfading between beats */}
      {composition.bRoll && composition.bRoll.length > 0 && (
        <AnimatePresence mode="popLayout">
          {activeBRoll && (
            <motion.div
              key={`bg-${bRollIndex}`}
              className="absolute inset-0 z-0"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{
                opacity: 1,
                scale: 1.16,
                transition: {
                  opacity: { duration: 0.6 },
                  scale: { duration: Math.max(4, (activeBRoll.endAt - activeBRoll.startAt) * 1.5), ease: "linear" },
                },
              }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeBRoll.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "saturate(0.92) contrast(0.96)" }}
              />
              {/* Cream wash so text stays legible */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(251,250,247,0.84) 0%, rgba(251,250,247,0.72) 60%, rgba(251,250,247,0.88) 100%)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Brand mark */}
      <div className="flex items-center gap-2 z-[1]">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center text-[14px] ring-1 ring-ink-100 shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${persona.primaryColor}28, ${persona.accentColor}40)`,
          }}
        >
          {persona.emoji}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-ink-800 leading-none truncate">
            {persona.name}
          </div>
          <div className="text-[9px] uppercase tracking-[0.16em] text-ink-400 mt-0.5">
            {persona.industry.split("—")[0].trim().slice(0, 28)}
          </div>
        </div>
      </div>

      {/* Hero / hook with word reveal */}
      <div
        className={cn(
          "z-[1] relative",
          layout === "vertical" ? "text-center" : "text-left",
        )}
      >
        <p
          className={cn(
            "font-display leading-[1.05] text-balance",
            layout === "horizontal" ? "text-[22px] md:text-[28px]" : "text-[24px]",
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
                  lit ? "text-ink-800" : "text-ink-400",
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
            transform: `scaleX(${Math.min(1, currentTime / totalDuration)})`,
            width: layout === "horizontal" ? "60%" : "40%",
            margin: layout === "vertical" ? "8px auto 0" : undefined,
          }}
        />
      </div>

      {/* CTA card — appears late in the video */}
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

/* ───────────────────────── Presenter side ───────────────────────── */

function PresenterSide({
  persona,
  isMockAvatar,
  videoUrl,
  videoRef,
  playing,
  layout,
  onEnded,
}: {
  persona: BrandPersona;
  isMockAvatar: boolean;
  videoUrl: string | undefined;
  videoRef: React.RefObject<HTMLVideoElement>;
  playing: boolean;
  layout: "horizontal" | "vertical";
  onEnded: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        layout === "horizontal" ? "w-1/2 h-full" : "w-full h-[42%]",
      )}
    >
      {/* Brand-colored backdrop behind the avatar */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 100%, ${persona.primaryColor}30 0%, ${persona.primaryColor}08 50%, transparent 100%)`,
        }}
      />

      {/* Soft framing card */}
      <div className="absolute inset-3 md:inset-4 rounded-xl overflow-hidden shadow-[0_18px_40px_-18px_rgba(30,12,10,0.25)] bg-ink-800">
        {/* Real HeyGen video */}
        {!isMockAvatar && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            onEnded={onEnded}
          />
        )}

        {/* Mock SVG avatar */}
        {isMockAvatar && <MockAvatar persona={persona} talking={playing} />}

        {/* "AI Avatar" badge */}
        <div className="absolute top-2 left-2 z-10 text-[9px] uppercase tracking-widest font-semibold text-white/85 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full border border-white/15">
          AI Avatar
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Mock avatar SVG ───────────────────────── */

function MockAvatar({
  persona,
  talking,
}: {
  persona: BrandPersona;
  talking: boolean;
}) {
  const pc = persona.primaryColor;
  const ac = persona.accentColor;
  const isFemale = (persona.voiceGender ?? "female") === "female";

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(140% 80% at 50% 0%, ${pc}33 0%, ${pc}11 35%, transparent 70%), linear-gradient(180deg, #0a0e14, #0a0e14)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(45% 45% at 28% 32%, ${ac}55, transparent 75%)`,
        }}
      />

      <svg
        className="absolute inset-0 m-auto h-[88%] w-auto"
        viewBox="0 0 200 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skin-mc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4d4b6" />
            <stop offset="1" stopColor="#d8a87f" />
          </linearGradient>
          <linearGradient id="shirt-mc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pc} />
            <stop offset="1" stopColor={ac} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <path
          d="M30 280 C 40 220 70 195 100 195 C 130 195 160 220 170 280 Z"
          fill="url(#shirt-mc)"
        />
        <rect x="88" y="170" width="24" height="30" rx="6" fill="url(#skin-mc)" />
        <ellipse cx="100" cy="120" rx="42" ry="50" fill="url(#skin-mc)" />

        {isFemale ? (
          <>
            <path
              d="M52 100 C 48 150 52 200 60 240 C 70 230 84 220 95 215 C 90 180 90 130 100 90 C 110 130 110 180 105 215 C 116 220 130 230 140 240 C 148 200 152 150 148 100 C 145 70 125 56 100 56 C 75 56 55 70 52 100 Z"
              fill="#3a2a22"
            />
            <path
              d="M60 100 C 62 78 84 64 100 64 C 122 64 142 80 144 104 C 138 92 122 86 100 90 C 80 92 66 96 60 100 Z"
              fill="#2d1f18"
            />
          </>
        ) : (
          <path
            d="M58 110 C 58 70 82 60 100 60 C 130 60 145 82 142 110 C 138 95 124 90 100 92 C 78 94 64 100 58 110 Z"
            fill="#2a1f1a"
          />
        )}

        <ellipse cx="86" cy="118" rx="3" ry="3.5" fill="#1a1a1a" />
        <ellipse cx="114" cy="118" rx="3" ry="3.5" fill="#1a1a1a" />
        <ellipse cx="87" cy="117" rx="1" ry="1" fill="#fff" />
        <ellipse cx="115" cy="117" rx="1" ry="1" fill="#fff" />

        <path
          d="M78 108 Q 86 104 94 108"
          stroke="#2a1f1a"
          strokeWidth={isFemale ? "1.4" : "2"}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M106 108 Q 114 104 122 108"
          stroke="#2a1f1a"
          strokeWidth={isFemale ? "1.4" : "2"}
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M100 124 Q 102 133 98 138 Q 102 140 104 138"
          stroke="#a87456"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />

        <g transform="translate(100 148)">
          <ellipse
            cx="0"
            cy="0"
            rx="9"
            ry={talking ? 4 : 1.5}
            fill={isFemale ? "#c44a5a" : "#5a2f2f"}
            style={{
              transition: "all 90ms ease-out",
              animation: talking ? "mc-mouth-talk 360ms infinite" : "none",
            }}
          />
        </g>

        {isFemale && (
          <>
            <ellipse cx="76" cy="138" rx="6" ry="3" fill="#e89090" opacity="0.35" />
            <ellipse cx="124" cy="138" rx="6" ry="3" fill="#e89090" opacity="0.35" />
          </>
        )}
      </svg>

      {talking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="h-40 w-40 rounded-full border border-white/10 animate-pulse-ring" />
        </div>
      )}

      <style jsx>{`
        @keyframes mc-mouth-talk {
          0% { transform: scaleY(1); }
          25% { transform: scaleY(1.7); }
          50% { transform: scaleY(0.4); }
          75% { transform: scaleY(1.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
