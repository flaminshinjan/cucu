export const env = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  modelSonnet: process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-6",
  modelHaiku: process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5",

  tavilyKey: process.env.TAVILY_API_KEY ?? "",

  openaiKey: process.env.OPENAI_API_KEY ?? "",
  ttsModel: process.env.OPENAI_TTS_MODEL ?? "tts-1",
  ttsVoice: process.env.OPENAI_TTS_VOICE ?? "alloy",

  avatarProvider: (process.env.AVATAR_PROVIDER ?? "mock") as "heygen" | "did" | "mock",
  heygenKey: process.env.HEYGEN_API_KEY ?? "",
  /** Override the auto-discovered HeyGen avatar / voice IDs */
  heygenAvatarId: process.env.HEYGEN_AVATAR_ID ?? "",
  heygenVoiceId: process.env.HEYGEN_VOICE_ID ?? "",
  didKey: process.env.DID_API_KEY ?? "",

  replicateToken: process.env.REPLICATE_API_TOKEN ?? "",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "cucu",
};

export const capabilities = {
  hasAnthropic: !!env.anthropicKey,
  hasTavily: !!env.tavilyKey,
  hasTTS: !!env.openaiKey,
  hasAvatar:
    (env.avatarProvider === "heygen" && !!env.heygenKey) ||
    (env.avatarProvider === "did" && !!env.didKey),
  hasReplicate: !!env.replicateToken,
  hasSupabase: !!env.supabaseUrl && !!env.supabaseKey,
};
