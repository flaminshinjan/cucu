export type PlatformId = "linkedin" | "youtube" | "instagram" | "x";

export interface Platform {
  id: PlatformId;
  name: string;
  shortName: string;
  aspect: "16:9" | "9:16" | "1:1";
  aspectRatio: number;
  brandColor: string;
  accent: string;
  description: string;
  voiceRules: string;
}

export type VoiceGender = "female" | "male" | "neutral";

export interface BrandPersona {
  id: string;
  name: string;
  tagline: string;
  industry: string;
  audience: string;
  voiceAttributes: string[];
  pillars: string[];
  forbiddenWords?: string[];
  primaryColor: string;
  accentColor: string;
  emoji: string;
  /** Drives avatar gender + TTS voice selection across all adapters. */
  voiceGender: VoiceGender;
}

export interface ResearchFinding {
  topic: string;
  why: string;
  signal: "trend" | "competitor" | "pain-point" | "format";
  source?: string;
}

export interface ResearchOutput {
  findings: ResearchFinding[];
  summary: string;
  topAngles: string[];
}

export interface StrategyOutput {
  pillars: Array<{ name: string; rationale: string }>;
  weeklyPlan: Array<{ day: string; pillar: string; format: string; hook: string }>;
  hero: { angle: string; hypothesis: string; pillar: string };
  formatMix: Record<PlatformId, string>;
}

export interface PlatformCopy {
  platform: PlatformId;
  hook: string;
  body: string;
  cta: string;
  hashtags?: string[];
  meta: {
    estimatedReadSeconds: number;
    characterCount: number;
  };
}

export type AvatarRenderStatus =
  | "idle"
  | "rendering"
  | "ready"
  | "failed"
  | "unavailable";

export interface ContentAssets {
  voiceAudioUrl?: string;
  avatarVideoUrl?: string;
  thumbnailUrl?: string;
  scriptHash: string;
  avatarStatus?: AvatarRenderStatus;
  avatarStatusReason?: string;
}

export interface BRollImage {
  url: string;
  /** Optional caption-style keyword overlaid on the image when shown. */
  keyword?: string;
  /** Where in the script the image lands (in seconds). */
  startAt: number;
  endAt: number;
}

export interface PlatformComposition {
  platform: PlatformId;
  copy: PlatformCopy;
  composedAt: number;
  /** Source video clip (avatar) shared across platforms */
  sourceVideoUrl?: string;
  thumbnailUrl?: string;
  /** 3 contextual b-roll images cycled on the content side of the marketing composition. */
  bRoll?: BRollImage[];
  captions: Array<{ start: number; end: number; text: string }>;
}

export type RunStage =
  | "queued"
  | "researching"
  | "strategizing"
  | "writing"
  | "voicing"
  | "rendering"
  | "composing"
  | "done"
  | "error";

export interface CustomBrief {
  /** Optional brand URL — added as a research query and as context for strategy. */
  url?: string;
  /** Optional focus — overrides the persona's default research topic. */
  focus?: string;
  /** Optional explicit audience description. */
  audience?: string;
}

export interface StudioConfig {
  /** HeyGen talking_photo_id from uploading a user-supplied face image. */
  talkingPhotoId?: string;
  /** Storage key of the uploaded voice sample. XTTS-v2 is zero-shot, so the
   *  "voice id" is really a pointer to the audio we'll resend on every render. */
  voiceId?: string;
  /** Which TTS pipeline owns voiceId — drives how we synthesize at render time. */
  voiceProvider?: "replicate" | "heygen";
  /** HeyGen avatar_id (picked from the public library). */
  avatarId?: string;
  /** Display labels for the UI so we don't lose context after refresh. */
  talkingPhotoLabel?: string;
  voiceLabel?: string;
  avatarLabel?: string;
}

export interface ContentRun {
  id: string;
  /** The original chat brief the operator typed. */
  message: string;
  /** Derived from the message on the server (via Haiku). */
  persona?: BrandPersona;
  brief?: CustomBrief;
  /** Optional user-supplied face / voice for the avatar render. */
  studio?: StudioConfig;
  createdAt: number;
  stage: RunStage;
  research?: ResearchOutput;
  strategy?: StrategyOutput;
  copies?: PlatformCopy[];
  assets?: ContentAssets;
  compositions?: PlatformComposition[];
  error?: string;
}

export type AgentName =
  | "coordinator"
  | "researcher"
  | "strategist"
  | "copywriter-linkedin"
  | "copywriter-youtube"
  | "copywriter-instagram"
  | "copywriter-x"
  | "art-director";

export interface StreamEvent {
  /** Monotonic event index for replay/reconnect */
  seq: number;
  ts: number;
  agent: AgentName;
  type:
    | "thinking"
    | "tool-call"
    | "tool-result"
    | "delta"
    | "result"
    | "stage"
    | "complete"
    | "error";
  message?: string;
  data?: unknown;
  stage?: RunStage;
}
