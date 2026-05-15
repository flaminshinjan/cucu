import type { Platform, PlatformId } from "./types";

export const PLATFORMS: Record<PlatformId, Platform> = {
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    shortName: "LI",
    aspect: "1:1",
    aspectRatio: 1,
    brandColor: "#0A66C2",
    accent: "from-[#0A66C2] to-[#004182]",
    description: "Long-form professional post, story arc, single CTA",
    voiceRules:
      "Authoritative but human. Hook in first 2 lines (mobile preview). Use line breaks for scan-ability. End with a question or pointed CTA. No hashtag spam — 3 max. Length: 700–1100 chars.",
  },
  youtube: {
    id: "youtube",
    name: "YouTube Shorts",
    shortName: "YT",
    aspect: "9:16",
    aspectRatio: 9 / 16,
    brandColor: "#FF0033",
    accent: "from-[#FF0033] to-[#990022]",
    description: "Vertical script, 45–60s, retention-engineered",
    voiceRules:
      "Energetic, fast-paced. Hook in first 3 seconds — payoff promise. Visual cues bracketed. 3-act structure: hook / build / payoff+CTA. Subtitles will be burned in. Length: 90–140 words.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram Reels",
    shortName: "IG",
    aspect: "9:16",
    aspectRatio: 9 / 16,
    brandColor: "#E1306C",
    accent: "from-[#E1306C] via-[#C13584] to-[#833AB4]",
    description: "Reel script + caption, mood-driven, save-bait",
    voiceRules:
      "Warm, conversational, visual-first. Short sentences. Caption ends with a save-worthy line. 5–7 hashtags discovery-mixed. Script length: 70–110 words. Caption: 120–220 chars.",
  },
  x: {
    id: "x",
    name: "X / Thread",
    shortName: "X",
    aspect: "16:9",
    aspectRatio: 16 / 9,
    brandColor: "#000000",
    accent: "from-zinc-900 to-zinc-700",
    description: "5–7 tweet thread, punchy, quotable",
    voiceRules:
      "Sharp, opinionated, quotable. First tweet stands alone. Each subsequent tweet earns its place. No hashtags unless brand-canonical. Final tweet recaps + CTA. 5–7 tweets, ≤ 270 chars each.",
  },
};

export const PLATFORM_ORDER: PlatformId[] = ["linkedin", "youtube", "instagram", "x"];

export function getPlatform(id: PlatformId): Platform {
  return PLATFORMS[id];
}
