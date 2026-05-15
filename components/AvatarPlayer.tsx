"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, VolumeX, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Caption {
  start: number;
  end: number;
  text: string;
}

interface Props {
  /** "client://avatar?persona=..." or "client://speech?text=..." or a real http(s) URL */
  videoUrl?: string;
  audioUrl?: string;
  captions?: Caption[];
  durationSeconds?: number;
  persona?: {
    primaryColor: string;
    accentColor: string;
    emoji: string;
    name: string;
    voiceGender?: "female" | "male" | "neutral";
  };
  aspect?: "9:16" | "16:9" | "1:1";
  autoplay?: boolean;
  /** When the player completes one play-through */
  onEnded?: () => void;
}

/**
 * Polymorphic avatar player.
 * - If videoUrl is a real http(s) URL → renders a <video> with audio.
 * - If videoUrl starts with client://avatar → renders the CSS/SVG mock avatar
 *   driven by either a real audio URL or the browser SpeechSynthesis API.
 */
export function AvatarPlayer({
  videoUrl,
  audioUrl,
  captions,
  durationSeconds = 0,
  persona,
  aspect = "9:16",
  autoplay = false,
  onEnded,
}: Props) {
  const isMockAvatar = !videoUrl || videoUrl.startsWith("client://avatar");
  const useBrowserSpeech =
    !audioUrl || audioUrl.startsWith("client://speech") || (videoUrl?.startsWith("client://avatar") && audioUrl?.startsWith("client://speech"));

  const aspectClass =
    aspect === "9:16" ? "aspect-[9/16]" : aspect === "16:9" ? "aspect-video" : "aspect-square";

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const tickRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Pull script text out of "client://speech?text=…" for SpeechSynthesis path
  const speechText = useMemo(() => {
    if (!audioUrl || !audioUrl.startsWith("client://speech")) return "";
    try {
      return decodeURIComponent(audioUrl.replace("client://speech?text=", ""));
    } catch {
      return "";
    }
  }, [audioUrl]);

  const totalDuration =
    durationSeconds || captions?.[captions.length - 1]?.end || 12;

  function stopEverything() {
    if (tickRef.current != null) {
      window.cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    startTimeRef.current = null;
  }

  function tick() {
    if (!startTimeRef.current) return;
    const t = (Date.now() - startTimeRef.current) / 1000;
    setProgress(Math.min(1, t / totalDuration));
    if (t >= totalDuration) {
      setPlaying(false);
      setProgress(1);
      onEnded?.();
      return;
    }
    tickRef.current = window.requestAnimationFrame(tick);
  }

  function play() {
    setPlaying(true);
    startTimeRef.current = Date.now() - progress * totalDuration * 1000;

    if (!isMockAvatar && videoRef.current) {
      videoRef.current.muted = muted;
      void videoRef.current.play();
    } else if (audioUrl && !useBrowserSpeech && audioRef.current) {
      audioRef.current.muted = muted;
      void audioRef.current.play();
    } else if (useBrowserSpeech && speechText && typeof window !== "undefined") {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speechText);
      u.rate = 1.02;
      u.pitch = 1;
      u.volume = muted ? 0 : 1;
      // Try to pick a voice matching the persona's gender from the OS's installed voices.
      // Browser voice metadata is messy — we match against a list of common name hints.
      const gender = persona?.voiceGender ?? "neutral";
      const voices = synth.getVoices();
      if (gender !== "neutral" && voices.length > 0) {
        const femaleHints = [
          "female", "samantha", "victoria", "karen", "moira", "tessa", "fiona", "veena",
          "kate", "serena", "susan", "allison", "ava", "zoe", "joanna", "salli", "emma",
        ];
        const maleHints = [
          "male", "alex", "daniel", "fred", "ralph", "tom", "lee", "diego", "rishi", "aaron",
          "matthew", "brian", "justin",
        ];
        const hints = gender === "female" ? femaleHints : maleHints;
        const englishMatch = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("en") &&
            hints.some((h) => v.name.toLowerCase().includes(h)),
        );
        const anyMatch = voices.find((v) =>
          hints.some((h) => v.name.toLowerCase().includes(h)),
        );
        const picked = englishMatch ?? anyMatch;
        if (picked) u.voice = picked;
      }
      utterRef.current = u;
      u.onend = () => {
        setPlaying(false);
        setProgress(1);
        onEnded?.();
      };
      synth.speak(u);
    }

    tickRef.current = window.requestAnimationFrame(tick);
  }

  function pause() {
    stopEverything();
  }

  useEffect(() => {
    if (autoplay) {
      const t = setTimeout(() => play(), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, videoUrl, audioUrl]);

  useEffect(() => stopEverything, []);

  const currentTime = progress * totalDuration;
  const activeCaption = captions?.find((c) => currentTime >= c.start && currentTime <= c.end);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-zinc-950 border border-border",
        aspectClass,
      )}
    >
      {/* Real video */}
      {!isMockAvatar && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          onEnded={() => {
            setPlaying(false);
            onEnded?.();
          }}
        />
      )}

      {/* Mock avatar — CSS/SVG character that "talks" while playing */}
      {isMockAvatar && <MockAvatar persona={persona} talking={playing} />}

      {/* Audio element for OpenAI TTS URL path */}
      {audioUrl && !useBrowserSpeech && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => {
            setPlaying(false);
            onEnded?.();
          }}
        />
      )}

      {/* Caption track */}
      {activeCaption && (
        <motion.div
          key={activeCaption.start}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute left-3 right-3 bottom-14 text-center"
        >
          <span className="inline-block bg-black/75 text-white text-[13px] md:text-sm px-3 py-1.5 rounded-md leading-snug font-medium text-balance">
            {activeCaption.text}
          </span>
        </motion.div>
      )}

      {/* Progress bar */}
      <div className="absolute left-0 right-0 bottom-9 px-3">
        <div className="h-0.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/90 transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute left-0 right-0 bottom-0 px-3 py-2 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent">
        <button
          onClick={() => (playing ? pause() : play())}
          className="h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center text-white transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>
        <button
          onClick={() => setMuted((m) => !m)}
          className="h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center text-white transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <div className="text-[10px] text-white/80 tabular-nums">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Pure-CSS/SVG "AI avatar" — silhouette with a mouth that animates while talking.
 * Replaced by real HeyGen/D-ID video when the env vars are present.
 */
function MockAvatar({
  persona,
  talking,
}: {
  persona?: {
    primaryColor: string;
    accentColor: string;
    emoji: string;
    name: string;
    voiceGender?: "female" | "male" | "neutral";
  };
  talking: boolean;
}) {
  const pc = persona?.primaryColor ?? "#0EBA87";
  const ac = persona?.accentColor ?? "#5EEAD4";
  const isFemale = (persona?.voiceGender ?? "female") === "female";
  return (
    <div className="absolute inset-0">
      {/* Backdrop gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(140% 80% at 50% 0%, ${pc}33 0%, ${pc}11 35%, transparent 70%), linear-gradient(180deg, #0a0e14, #0a0e14)`,
        }}
      />
      {/* Studio rim light */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(45% 45% at 28% 32%, ${ac}55, transparent 75%)`,
        }}
      />

      {/* Brand tag */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white/80">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-2 py-0.5 border border-white/10">
          <span
            className="h-5 w-5 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: `linear-gradient(135deg, ${pc}, ${ac})` }}
          >
            {persona?.emoji ?? "✨"}
          </span>
          <span className="text-[10px] font-medium tracking-wide">
            {persona?.name ?? "Brand"}
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-widest text-white/40 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full border border-white/10">
          AI Avatar
        </div>
      </div>

      {/* SVG character */}
      <svg
        className="absolute inset-0 m-auto h-[78%] w-auto"
        viewBox="0 0 200 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4d4b6" />
            <stop offset="1" stopColor="#d8a87f" />
          </linearGradient>
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pc} />
            <stop offset="1" stopColor={ac} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Body / shoulders */}
        <path
          d="M30 280 C 40 220 70 195 100 195 C 130 195 160 220 170 280 Z"
          fill="url(#shirtGrad)"
        />
        {/* Neck */}
        <rect x="88" y="170" width="24" height="30" rx="6" fill="url(#skinGrad)" />
        {/* Head */}
        <ellipse cx="100" cy="120" rx="42" ry="50" fill="url(#skinGrad)" />
        {isFemale ? (
          <>
            {/* Long hair behind shoulders */}
            <path
              d="M52 100 C 48 150 52 200 60 240 C 70 230 84 220 95 215 C 90 180 90 130 100 90 C 110 130 110 180 105 215 C 116 220 130 230 140 240 C 148 200 152 150 148 100 C 145 70 125 56 100 56 C 75 56 55 70 52 100 Z"
              fill="#3a2a22"
            />
            {/* Front bangs/fringe sweeping across forehead */}
            <path
              d="M60 100 C 62 78 84 64 100 64 C 122 64 142 80 144 104 C 138 92 122 86 100 90 C 80 92 66 96 60 100 Z"
              fill="#2d1f18"
            />
            {/* Earrings hint */}
            <circle cx="58" cy="138" r="1.6" fill="#f5d76e" />
            <circle cx="142" cy="138" r="1.6" fill="#f5d76e" />
          </>
        ) : (
          /* Short cropped hair */
          <path
            d="M58 110 C 58 70 82 60 100 60 C 130 60 145 82 142 110 C 138 95 124 90 100 92 C 78 94 64 100 58 110 Z"
            fill="#2a1f1a"
          />
        )}

        {/* Eyes */}
        <g>
          <ellipse cx="86" cy="118" rx="3" ry="3.5" fill="#1a1a1a" />
          <ellipse cx="114" cy="118" rx="3" ry="3.5" fill="#1a1a1a" />
          <ellipse cx="87" cy="117" rx="1" ry="1" fill="#fff" />
          <ellipse cx="115" cy="117" rx="1" ry="1" fill="#fff" />
          {isFemale && (
            <>
              {/* Lashes hint */}
              <path d="M82 114 L 80 112" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />
              <path d="M90 114 L 92 112" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />
              <path d="M110 114 L 108 112" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />
              <path d="M118 114 L 120 112" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />
            </>
          )}
        </g>

        {/* Eyebrows — slightly thinner for female */}
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

        {/* Nose */}
        <path
          d="M100 124 Q 102 133 98 138 Q 102 140 104 138"
          stroke="#a87456"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Mouth — soft lipstick tone for female, neutral for male */}
        <g transform="translate(100 148)">
          <ellipse
            cx="0"
            cy="0"
            rx="9"
            ry={talking ? 4 : 1.5}
            fill={isFemale ? "#c44a5a" : "#5a2f2f"}
            style={{
              transition: "all 90ms ease-out",
              animation: talking ? "mouth-talk 360ms infinite" : "none",
            }}
          />
        </g>

        {/* Cheek blush for female */}
        {isFemale && (
          <>
            <ellipse cx="76" cy="138" rx="6" ry="3" fill="#e89090" opacity="0.35" />
            <ellipse cx="124" cy="138" rx="6" ry="3" fill="#e89090" opacity="0.35" />
          </>
        )}
      </svg>

      {/* Subtle "live" pulse ring when talking */}
      {talking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-40 w-40 rounded-full border border-white/10 animate-pulse-ring" />
        </div>
      )}

      <style jsx>{`
        @keyframes mouth-talk {
          0% {
            transform: scaleY(1);
          }
          25% {
            transform: scaleY(1.7);
          }
          50% {
            transform: scaleY(0.4);
          }
          75% {
            transform: scaleY(1.3);
          }
          100% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
