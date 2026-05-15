# Content Agent · 3-Day MVP

A multi-agent content system that takes a brand persona, researches its niche, designs a content strategy, writes platform-tailored copy for **LinkedIn, YouTube Shorts, Instagram Reels, and X**, and renders an AI avatar presenter — all live, streamed to the UI as the agents work.

Built against the 3-day MVP build plan. The sales close moment is the **four-platform reveal**: prospects see their brand's content rendered side-by-side in native aspect ratios.

---

## Architecture

A **Coordinator** orchestrates four specialist sub-agents over SSE-streamed events:

| Sub-agent | Role | Model |
|---|---|---|
| Researcher | Pulls trending topics, competitor angles, audience pain points via Tavily | Haiku 4.5 |
| Strategist | Proposes content pillars, weekly plan, hero angle (structured JSON) | Sonnet 4.6 |
| Copywriter ×4 | Parallel platform-specific drafts + voice-consistency pass | Sonnet 4.6 |
| Art Director | Voice (TTS) → avatar render → per-platform composition | Haiku 4.5 |

```
┌──────────────┐   POST /api/run
│   Browser    │ ───────────────▶ Coordinator ─┬─ Researcher (Tavily + Haiku)
│              │ ◀───── SSE ─────              ├─ Strategist (Sonnet, JSON)
│  EventSource │   /api/stream/[id]            ├─ Copywriters ×4 (Sonnet, parallel)
└──────────────┘                                └─ Art Director ─ Voice + Avatar + Thumbs
```

## Adapter pattern — bring your keys when you have them

Every external service has a clean adapter with a high-fidelity mock fallback. **Run it cold with zero keys** and you still see the full UX — agents stream, copy materializes, the avatar talks, and the reveal moment fires. Add a key, that part swaps to the real provider with **zero architecture changes**.

| Service | Real provider | Without key |
|---|---|---|
| LLM (strategy + copy) | Anthropic Sonnet 4.6 | Deterministic fixtures, streamed word-by-word for the UI |
| LLM (research summary) | Anthropic Haiku 4.5 | Same |
| Research | Tavily | Topical mock results keyed off persona |
| TTS | OpenAI tts-1 (smallest viable, ~$0.015/1k chars) | Browser `SpeechSynthesis` API |
| Avatar | HeyGen v2 or D-ID | CSS/SVG avatar with lip-sync animation |
| Images | Flux Schnell via Replicate | Deterministic gradient placeholder SVG |
| Storage | Supabase Storage | Local filesystem under `public/generated` |

Aggressive **caching by script hash** so repeat runs are instant — critical for live demos.

## Local dev

```bash
npm install
cp .env.example .env.local      # fill in keys you have
npm run dev                     # http://localhost:3000
```

No keys? Still works. Pick a persona, click **Run content agent**.

## Deploy to Fly.io

```bash
fly launch --no-deploy           # claim an app name; edit fly.toml app = "..."
fly volumes create content_data --size 1 --region iad
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set TAVILY_API_KEY=tvly-...
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set AVATAR_PROVIDER=heygen HEYGEN_API_KEY=...
fly secrets set REPLICATE_API_TOKEN=r8_...
fly deploy
```

The Dockerfile produces a Next.js standalone image. Fly's proxy handles SSE fine, and `min_machines_running = 0` saves cost when idle. Health check pings `/api/personas`.

## Project layout

```
app/
  page.tsx               # Three-column UI shell
  api/
    personas/route.ts    # GET — seed personas + capability flags
    run/route.ts         # POST — start a run
    run/[id]/route.ts    # GET — current snapshot
    stream/[id]/route.ts # SSE — agent events
lib/
  agents/                # Coordinator, Researcher, Strategist, Copywriters, Art Director
  adapters/              # LLM, research, voice, avatar, image, storage
  platforms.ts           # LinkedIn / YouTube / Instagram / X format rules
  personas.ts            # Seed brand personas (B2B SaaS + Fitness)
  store.ts               # In-memory run state + SSE pub/sub
  types.ts               # Shared TypeScript types
components/
  BrandPicker.tsx        # Left column: persona + Run button + capability lights
  AgentLog.tsx           # Center column: stage timeline + streaming activity log
  OutputPreview.tsx      # Right column: research / strategy / copy / compose tabs
  PlatformFrame.tsx      # Native LinkedIn / YT / IG / X chrome around the avatar
  PlatformReveal.tsx     # Cinematic four-platform reveal modal
  AvatarPlayer.tsx       # Plays real video OR animates SVG avatar with TTS/browser audio
```

## The demo flow

1. Pick a persona (Lumen Analytics or Maya Strong)
2. Click **Run content agent**
3. Watch the stage timeline progress: Research → Strategy → Copy → Voice → Avatar → Compose
4. The center log streams every tool call, thought, and partial generation in real time
5. The right pane fills in: research findings, strategy, copy tabs, a single-platform preview
6. Done — the **Reveal all 4 platforms** modal animates in with side-by-side native frames

### Timing with real keys

| Stage | Time | Notes |
|---|---|---|
| Research (Tavily + Haiku) | ~10–15s | 3 parallel searches + summary |
| Strategy (Sonnet) | ~15–25s | Pillars + weekly plan + hero |
| Copy ×4 (Sonnet, parallel) + voice pass | ~25–35s | All platforms at once |
| Voice (OpenAI TTS) + thumbnails (Flux) | ~5–10s | Parallel |
| **Total visible pipeline** | **~70–85s** | Reveal auto-fires here |
| HeyGen avatar (background) | 3–15 min (free tier) | Hot-swaps into the reveal when ready |

**The reveal does not wait for HeyGen.** It opens with the CSS mock avatar (which is
already cinematic with timed captions, brand chrome, and lip-sync) and the real HeyGen
video swaps in across all four platform frames the moment it's ready. Subsequent runs of
the same script hit the avatar cache → instant.

### Common live-API gotchas

- **HeyGen free tier render queue**: short scripts (~5–10s of audio) render in 1–2 min;
  full 50-second YouTube Shorts can take 8–15 min in busy periods. The non-blocking flow
  is designed for exactly this — the demo is presentable in 80s either way.
- **Replicate Flux 402 (no credit)**: load $5 of credit on replicate.com or leave
  `REPLICATE_API_TOKEN` blank — the gradient placeholder thumbnails are intentionally
  good-looking.
- **Pre-warm before live demos**: trigger one run per persona ahead of the call so the
  avatar lands in cache. Subsequent identical scripts skip HeyGen entirely.

## Risks & mitigations (from the build plan)

- **Avatar render latency unpredictable** — cache-by-script-hash + adapter mock keeps the demo deterministic
- **SSE buffering/reconnects** — keep-alive ping every 15s, `Last-Event-ID` replay, server backlog
- **Brand-voice drift across 4 parallel agents** — Sonnet consistency pass after the parallel writes
- **Free-tier rate limits** — every adapter caches; mock fallback avoids hammering APIs in dev

## Path from MVP to cinematic

The architecture is designed so each lever swaps independently:

- **Avatar:** flip `AVATAR_PROVIDER=heygen` and add the key → real avatar video, no code changes
- **Voice cloning:** add ElevenLabs adapter alongside OpenAI in `lib/adapters/voice.ts`
- **Research depth:** add Exa + Apify adapters alongside Tavily
- **Distribution:** add LinkedIn/Buffer posting adapter once a prospect commits
- **Brand intake:** swap `lib/personas.ts` for a URL/document ingestion flow
