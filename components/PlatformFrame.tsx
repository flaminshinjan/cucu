"use client";

import { Heart, MessageCircle, Repeat2, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2 } from "lucide-react";
import type { BrandPersona, PlatformComposition } from "@/lib/types";
import { PLATFORMS } from "@/lib/platforms";
import { AvatarPlayer } from "@/components/AvatarPlayer";
import { cn } from "@/lib/utils";

interface Props {
  composition: PlatformComposition;
  persona: BrandPersona;
  voiceAudioUrl?: string;
  avatarVideoUrl?: string;
  autoplay?: boolean;
  /** Compact mode tightens spacing for the four-up reveal grid */
  compact?: boolean;
}

export function PlatformFrame({
  composition,
  persona,
  voiceAudioUrl,
  avatarVideoUrl,
  autoplay = false,
  compact = false,
}: Props) {
  switch (composition.platform) {
    case "youtube":
      return (
        <YouTubeFrame
          composition={composition}
          persona={persona}
          voiceAudioUrl={voiceAudioUrl}
          avatarVideoUrl={avatarVideoUrl}
          autoplay={autoplay}
          compact={compact}
        />
      );
    case "instagram":
      return (
        <InstagramFrame
          composition={composition}
          persona={persona}
          voiceAudioUrl={voiceAudioUrl}
          avatarVideoUrl={avatarVideoUrl}
          autoplay={autoplay}
          compact={compact}
        />
      );
    case "linkedin":
      return (
        <LinkedInFrame
          composition={composition}
          persona={persona}
          voiceAudioUrl={voiceAudioUrl}
          avatarVideoUrl={avatarVideoUrl}
          autoplay={autoplay}
          compact={compact}
        />
      );
    case "x":
      return (
        <XFrame
          composition={composition}
          persona={persona}
          voiceAudioUrl={voiceAudioUrl}
          avatarVideoUrl={avatarVideoUrl}
          autoplay={autoplay}
          compact={compact}
        />
      );
  }
}

/* ---------------- YouTube Shorts (9:16) ---------------- */

function YouTubeFrame(p: Props) {
  const { composition, persona } = p;
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
      <div className="relative w-full aspect-[9/16]">
        <AvatarPlayer
          videoUrl={p.avatarVideoUrl}
          audioUrl={p.voiceAudioUrl}
          captions={composition.captions}
          durationSeconds={composition.captions[composition.captions.length - 1]?.end}
          persona={persona}
          aspect="9:16"
          autoplay={p.autoplay}
        />
        {/* Right rail */}
        <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3 text-white">
          <RailButton icon={<ThumbsUp size={16} />} label="14K" />
          <RailButton icon={<MessageCircle size={16} />} label="822" />
          <RailButton icon={<Share2 size={16} />} label="Share" />
          <RailButton icon={<Bookmark size={16} />} label="Save" />
        </div>
        {/* Bottom meta */}
        <div className="absolute left-2 right-14 bottom-12 text-white text-[11px] line-clamp-3 leading-snug">
          <div className="font-semibold mb-1">@{persona.name.replace(/\s+/g, "").toLowerCase()}</div>
          <div className="opacity-90">{composition.copy.hook}</div>
        </div>
        {/* Brand badge */}
        <BrandRibbon persona={persona} label="YouTube Shorts" color="#FF0033" />
      </div>
    </div>
  );
}

function RailButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-9 w-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[9px] mt-0.5">{label}</span>
    </div>
  );
}

/* ---------------- Instagram Reels (9:16) ---------------- */

function InstagramFrame(p: Props) {
  const { composition, persona } = p;
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
      <div className="relative w-full aspect-[9/16]">
        <AvatarPlayer
          videoUrl={p.avatarVideoUrl}
          audioUrl={p.voiceAudioUrl}
          captions={composition.captions}
          durationSeconds={composition.captions[composition.captions.length - 1]?.end}
          persona={persona}
          aspect="9:16"
          autoplay={p.autoplay}
        />
        {/* Right rail (heart/comment/share/save) */}
        <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3 text-white">
          <RailButton icon={<Heart size={16} />} label="62K" />
          <RailButton icon={<MessageCircle size={16} />} label="" />
          <RailButton icon={<Send size={16} />} label="" />
          <RailButton icon={<Bookmark size={16} />} label="" />
        </div>
        {/* Bottom caption */}
        <div className="absolute left-2 right-14 bottom-12 text-white text-[11px] leading-snug">
          <div className="font-semibold mb-1">
            {persona.name.toLowerCase().replace(/\s+/g, "_")}
            <span className="ml-1 text-white/80 font-normal">· Original audio</span>
          </div>
          <div className="opacity-90 line-clamp-3">{composition.copy.hook}</div>
          {composition.copy.hashtags && (
            <div className="text-[10px] text-sky-300/90 mt-1 line-clamp-1">
              {composition.copy.hashtags.slice(0, 4).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            </div>
          )}
        </div>
        {/* Brand badge */}
        <BrandRibbon
          persona={persona}
          label="Instagram Reels"
          gradient="linear-gradient(135deg, #E1306C, #C13584, #833AB4)"
        />
      </div>
    </div>
  );
}

/* ---------------- LinkedIn (1:1 native post) ---------------- */

function LinkedInFrame(p: Props) {
  const { composition, persona } = p;
  return (
    <div className="rounded-xl overflow-hidden bg-white text-zinc-900 shadow-2xl border border-zinc-300">
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
          style={{
            background: `linear-gradient(135deg, ${persona.primaryColor}, ${persona.accentColor})`,
          }}
        >
          <span className="text-white">{persona.emoji}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight truncate">
            {persona.name}
          </div>
          <div className="text-[11px] text-zinc-500 leading-tight truncate">
            {persona.tagline} · 2nd
          </div>
          <div className="text-[10px] text-zinc-400">3h · 🌐</div>
        </div>
        <MoreHorizontal size={18} className="ml-auto text-zinc-400 shrink-0" />
      </div>

      <div className="px-4 pb-2">
        <pre className="font-sans text-[13px] leading-relaxed text-zinc-800 whitespace-pre-wrap line-clamp-[10]">
          {composition.copy.hook}
          {"\n\n"}
          {composition.copy.body}
        </pre>
        <button className="text-[11px] text-zinc-500 mt-1 hover:underline">…see more</button>
      </div>

      <div className="border-t border-zinc-200">
        <AvatarPlayer
          videoUrl={p.avatarVideoUrl}
          audioUrl={p.voiceAudioUrl}
          captions={composition.captions}
          durationSeconds={composition.captions[composition.captions.length - 1]?.end}
          persona={persona}
          aspect="1:1"
          autoplay={p.autoplay}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 text-zinc-500 text-[11px]">
        <span>👍❤️🎯 1,284</span>
        <span>312 comments · 88 reposts</span>
      </div>
      <div className="grid grid-cols-4 border-t border-zinc-200 text-[11px] font-medium text-zinc-600">
        <button className="py-2 flex items-center justify-center gap-1.5 hover:bg-zinc-100">
          <ThumbsUp size={13} /> Like
        </button>
        <button className="py-2 flex items-center justify-center gap-1.5 hover:bg-zinc-100">
          <MessageCircle size={13} /> Comment
        </button>
        <button className="py-2 flex items-center justify-center gap-1.5 hover:bg-zinc-100">
          <Repeat2 size={13} /> Repost
        </button>
        <button className="py-2 flex items-center justify-center gap-1.5 hover:bg-zinc-100">
          <Send size={13} /> Send
        </button>
      </div>
    </div>
  );
}

/* ---------------- X / Thread (16:9 attached video) ---------------- */

function XFrame(p: Props) {
  const { composition, persona } = p;
  return (
    <div className="rounded-xl overflow-hidden bg-black text-zinc-100 shadow-2xl border border-zinc-800">
      <div className="px-3 pt-3 pb-1.5 flex items-start gap-2.5">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
          style={{
            background: `linear-gradient(135deg, ${persona.primaryColor}, ${persona.accentColor})`,
          }}
        >
          <span className="text-white">{persona.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[13px] leading-tight">
            <span className="font-bold truncate">{persona.name}</span>
            <span className="text-zinc-500 truncate">
              @{persona.name.replace(/\s+/g, "").toLowerCase()} · 2h
            </span>
          </div>
          <div className="text-[14px] mt-1.5 leading-snug">{composition.copy.hook}</div>
          <div className="text-[13px] mt-1.5 leading-snug text-zinc-300 line-clamp-3 whitespace-pre-wrap">
            {composition.copy.body.split("\n").slice(0, 3).join("\n")}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="rounded-2xl overflow-hidden border border-zinc-800">
          <AvatarPlayer
            videoUrl={p.avatarVideoUrl}
            audioUrl={p.voiceAudioUrl}
            captions={composition.captions}
            durationSeconds={composition.captions[composition.captions.length - 1]?.end}
            persona={persona}
            aspect="16:9"
            autoplay={p.autoplay}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-zinc-500 text-[12px]">
        <span className="flex items-center gap-1.5">
          <MessageCircle size={14} /> 1.2K
        </span>
        <span className="flex items-center gap-1.5">
          <Repeat2 size={14} /> 4.4K
        </span>
        <span className="flex items-center gap-1.5">
          <Heart size={14} /> 31K
        </span>
        <span className="flex items-center gap-1.5">
          <Bookmark size={14} /> 8.1K
        </span>
      </div>
    </div>
  );
}

/* ---------------- Shared chrome ---------------- */

function BrandRibbon({
  label,
  color,
  gradient,
}: {
  persona: BrandPersona;
  label: string;
  color?: string;
  gradient?: string;
}) {
  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full text-white shadow-md border border-white/20"
      style={{
        background: gradient ?? color ?? "rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </div>
  );
}
