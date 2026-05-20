# cucu — Demo Doc

> Multi-platform content, on demand. A multi-agent system that takes a one-line
> brief and ships a finished Instagram Reel — research, strategy, copy,
> voiceover, and AI-avatar video — in under three minutes.

---

## 🎥 Demo video

<!-- Paste your screen recording / Loom / YouTube embed below -->

> _[ your demo recording goes here ]_

---

## What cucu does

You type a brief into a chat input. cucu does five things in parallel and in
sequence:

1. **Derives a brand persona** from your free-text input (name, tagline, audience,
   voice attributes, brand colors, emoji, voice gender) — _Haiku 4.5_.
2. **Researches the niche** — pulls trending topics, competitor angles, and
   audience pain points via _Tavily_, then summarizes findings — _Haiku 4.5_.
3. **Strategizes the angle** — picks a hero angle, pillars, weekly cadence, hook
   hypothesis — _Sonnet 4.6_, structured JSON.
4. **Writes the Instagram Reel** — hook + body + CTA + hashtags in the brand's
   voice — _Sonnet 4.6_.
5. **Renders the marketing video** — voiceover via _OpenAI TTS-1_, AI avatar via
   _HeyGen_ (or _D-ID_), 3 contextual b-roll images via _Replicate Flux Schnell_,
   composited into a 9:16 Instagram Reel layout in-browser.

**Output**: a 9:16 marketing video with a split layout — animated content side
(brand mark, animated hero headline, b-roll Ken-Burns backdrop, CTA card) on top,
talking-head AI avatar below. Native captions, native progress, native controls.
Maximizable. Saved to history.

---

## The agent system

5 sub-agents orchestrated by a Coordinator. Each emits SSE events back to the
client so the user watches the system think in real time.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Coordinator                                │
│  (orchestrates stages, emits stream events, manages run state)   │
└──┬───────┬───────┬───────┬───────┬───────────────────────────────┘
   │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────────────────┐
│Brand │ │Resea-│ │Strat-│ │Copy- │ │   Art Director          │
│derive│ │rcher │ │egist │ │writer│ │   (voice + avatar       │
│      │ │      │ │      │ │      │ │    + b-roll + compose)  │
│Haiku │ │Haiku │ │Sonnet│ │Sonnet│ │                          │
│ 4.5  │ │ 4.5  │ │ 4.6  │ │ 4.6  │ │  OpenAI TTS · HeyGen/    │
│      │ │+Tav- │ │      │ │      │ │  D-ID · Replicate Flux   │
│      │ │ily   │ │      │ │      │ │                          │
└──────┘ └──────┘ └──────┘ └──────┘ └──────────────────────────┘

       Streams to:  ┌─────────────────────┐
                    │  Client (Next.js)   │
                    │  • Chat panel       │
                    │  • Progress view    │
                    │  • Output viewer    │
                    │  • Maximize modal   │
                    │  • Run history      │
                    └─────────────────────┘
```

| Stage | Sub-agent | Model / API | Typical time |
|---|---|---|---|
| `queued → researching` | Coordinator + Brand Derive | Haiku 4.5 | 5 s |
| `researching` | Researcher | Haiku 4.5 + Tavily | 10–15 s |
| `strategizing` | Strategist | Sonnet 4.6 (JSON) | 20–30 s |
| `writing` | Copywriter | Sonnet 4.6 (JSON) | 5–10 s |
| `voicing` + `composing` | Art Director | OpenAI TTS + Flux ×4 | 25–40 s |
| **Visible pipeline done** | — | — | **~55–90 s** |
| `rendering` (background) | Art Director | HeyGen or D-ID | 3–4 min (HeyGen), 30–60 s (D-ID) |
| **Avatar hot-swap into video** | — | — | runs in background, swaps in when ready |

The pipeline is **non-blocking on the avatar**: the visible reveal fires at
~80 s with a clean brand-emblem placeholder. When the real avatar finishes
rendering in the background, it hot-swaps into the video without reload.

---

## Third-party stack

Every adapter has a high-fidelity mock fallback, so cucu runs with **zero
keys** during development. Add keys and each component upgrades in place.

| Provider | What it does | Used by | Notes |
|---|---|---|---|
| **Anthropic Claude** | Brand derivation, research synthesis, strategy, copy, voice consistency | All LLM agents | Sonnet 4.6 for the higher-quality work; Haiku 4.5 for cheaper summarization. Pay-per-token. |
| **Tavily** | Real-time web research | Researcher | 3 parallel searches per run (trends / competitors / pain-points). Free tier covers a few hundred runs/mo. |
| **OpenAI TTS-1** | Voice generation | Art Director | Mapped per persona gender: `nova` (female) / `onyx` (male). ~$0.015 per 1k chars (~$0.001 per render). |
| **HeyGen** | AI avatar video render | Art Director | Auto-discovers gender-matched avatar + voice. Sends `talking_photo_id` if user uploaded a custom face. **Important:** "API credits" are sold separately from plan credits — confirm you have non-zero `api` quota on the `/v2/user/remaining_quota` endpoint. |
| **D-ID** | Alternate AI avatar render | Art Director | Faster (30–60s) and simpler pricing than HeyGen. Flip `AVATAR_PROVIDER=did`. Uses Microsoft Azure Neural voices. $5.90/mo entry plan includes API. |
| **Replicate Flux Schnell** | B-roll image generation (3 per run) | Art Director | $0.003 per image, ~$0.012 per cucu run. Free tier rate-limits aggressively (429); our adapter has 4-attempt exponential backoff (4s→8s→16s→32s). |
| **Supabase** _(optional)_ | Persistent asset storage | Storage adapter | Falls back to local filesystem when not configured. |

**Browser fallbacks** (no key required):

- **Browser SpeechSynthesis** when OpenAI key is absent — uses the OS's TTS engine
- **Brand emblem (CSS/SVG)** when no avatar provider is configured — gender-aware
  circular brand mark with audio-driven pulse animation
- **Branded gradient SVG** when Replicate fails — uses persona's primary/accent
  colors so the b-roll still looks intentional

---

## Frontend capabilities

### Chat (left column)
- Free-form text input — describe any brand, persona, or topic
- Three example chips (B2B SaaS, fitness coach, Stripe / cross-border)
- Persistent chat history — past briefs and cucu replies stay visible
- Each cucu bubble updates live with stage progress
- Brand-derived persona pill appears as soon as Haiku has parsed the brief
- ⌘ + Enter to submit

### Right panel — three modes
**Idle**: serif "c" with pulsing brand dot + "Tell cucu what to make."

**Progress** (during run):
- Big stage hero card with current stage name and pulse-ring icon
- Live elapsed-seconds counter
- Animated progress bar + 7-stage chip strip
- Materializing-results feed: brand-derived card → research summary → strategy hero angle → copy progress
- "Now happening" feed shows the active agent's current thought / tool call

**Output** (when done):
- Hero angle in large serif type
- Single 9:16 Instagram Reel filling the available height
- 50/50 vertical split (content / presenter)
- Click any frame to maximize → fullscreen viewer with autoplay
- Native play/pause + click-to-seek progress + replay-after-end + mute

### Studio (top of chat)
- **Upload your face** → HeyGen Talking Photo → personalized avatar
- **Upload your voice** → HeyGen Instant Voice Clone → personalized TTS
- Stored in localStorage; persist across runs and reloads
- Active indicators show what's been customized

### Run history (top of chat)
- Auto-saves every completed run to localStorage
- Up to 20 most-recent runs, dedupes by run ID
- Re-saves on avatar hot-swap so the real video URL persists
- Click any past run to restore — instant, no API calls
- Survives page reload

### Marketing video composition (the actual output)
- **Content side**: brand mark, animated hero hook with word-by-word color reveal driven by playback time, brand-color underline that scales with progress, CTA card slides in at 65%, b-roll Ken-Burns backdrop with cream wash for legibility
- **Presenter side**: real HeyGen/D-ID video edge-to-edge, OR clean brand-emblem fallback with audio-driven pulse rings and a small loader pill showing "Rendering avatar" / "HeyGen credits needed" / "Brand emblem"
- **Captions**: timed track overlays the bottom, synced to the spoken script

---

## Architecture

**Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion. Single
Next.js app handles both UI and API routes. Adapter pattern isolates each
external service. Deployable to Fly.io with the included `Dockerfile` and
`fly.toml`.

**Streaming**: Server-Sent Events from `/api/stream/[id]`. The client EventSource
listens for `thinking`, `tool-call`, `tool-result`, `delta`, `result`, `stage`,
`complete`, `error` event types. Reconnect-safe via `Last-Event-ID`.

**State**:
- In-memory `globalThis.__runs` Map indexed by `runId` (survives Next.js HMR)
- JSON snapshots persisted to `data/runs/*.json` for survival across restarts
- Chat history + Studio config + run history live in browser `localStorage`

**Cost-aware design choices**:
- Single Instagram Reel output (not 4 platforms) → 4× lower image gen cost
- Spoken script trimmed to ~250 chars (~12s audio) via `condenseScript()` → keeps HeyGen per-render cost to ~6–8 credits instead of 40–60
- Per-prompt brand-aware gradient SVG fallback when Flux throttles → output still looks intentional, not empty
- Cache-by-script-hash on voice and avatar → repeat runs with identical scripts skip the API entirely

**Error tolerance**:
- Sonnet returning malformed JSON → 2-pass `parseJSON` (repairs trailing commas, smart quotes, control chars) → retry-once-then-fallback in copywriters
- HeyGen burst-throttle (rejects new submissions despite credits) → adapter retries with 60s backoff before falling back to brand emblem
- Replicate 429 → 4 attempts with exponential backoff per image; gradient SVG fallback if all retries fail
- Avatar render failure does NOT mark the run errored — pipeline still completes with brand emblem

---

## Scenarios to demo

### Scenario 1 — Indie creator brand on the fly
**Brief**:
> A strength training coach named Maya Strong for working women 30-45 who are
> tired of HIIT and want sustainable strength. Counter-program the influencer noise.

**What happens**:
- Haiku derives "Maya Strong" persona with female voice gender, purple/pink brand palette
- Tavily pulls fitness research (progressive overload, recovery, sleep)
- Sonnet writes a hero angle like _"Strength training that fits real life — even when life doesn't fit"_
- Output: 9:16 Reel with the hook animating in serif, Ken-Burns b-roll of gym scenes, female avatar voiceover

**Demo points**:
- "I never created Maya Strong — cucu invented her from a one-line brief"
- "The brand colors, the voice, the angles — all derived in 5 seconds"

---

### Scenario 2 — Real B2B brand from a URL
**Brief**:
> Make content for Stripe (https://stripe.com) about cross-border payments
> for SMBs in Southeast Asia. Audience: $1-10M ARR SaaS operators.

**What happens**:
- Haiku derives "Stripe Cross-Border" with fintech industry, blue brand palette
- Tavily searches across the Stripe URL plus the topic
- Strategy lands a hero angle tied to the SEA market specifically
- B-roll matches fintech aesthetic — laptops, hands, modern offices

**Demo points**:
- "Plug in a real company URL — cucu reads the brand and stays on-message"
- "Tavily found 5 real research signals in 12 seconds; Sonnet picked the sharpest angle"

---

### Scenario 3 — Studio mode (your face, your voice)
**Setup**: Click **Studio** in the chat panel. Upload a 1024×1024 photo of
yourself. Upload a 30–60s WAV of you speaking. Both go to HeyGen and return
talking_photo_id and voice_id. localStorage saves them.

**Brief**: anything you want.

**What happens**:
- Same pipeline runs
- HeyGen renders the avatar using **your face**, speaking with **your cloned
  voice**
- Hot-swaps into the video when ready

**Demo points**:
- "Your face, your voice, but cucu wrote the script"
- "Voice cloning is one-time — every future run uses it automatically"
- Note: HeyGen voice cloning requires Pro plan; Photo Avatar works on all paid tiers

---

### Scenario 4 — History replay
**Setup**: After running 2–3 briefs, click the **History** pill in the chat panel.

**What happens**:
- Sheet lists all past runs with timestamps and "Real avatar" / "Brand emblem" indicators
- Click any past run → right panel instantly restores that output
- Zero API calls — everything from localStorage
- Reload the page; history persists

**Demo points**:
- "Every cucu generation is saved locally — your sales call can stack 3 demos on top of each other"
- "Reload the page mid-call, your history is still there"

---

## Timing reference for a real demo

| Moment | What's visible |
|---|---|
| t = 0 s | User hits send. Chat bubble appears. cucu reply with "Starting up…" |
| t ≈ 5 s | Brand derived. Persona pill (name + emoji + colors) lands in chat |
| t ≈ 15 s | Research summary materializes in the progress feed |
| t ≈ 40 s | Hero angle in big serif on the progress feed (the wow moment) |
| t ≈ 55 s | Copy ready. Voicing kicks in |
| t ≈ 70 s | Voice + b-roll + composition done — **output view fires** with the brand emblem placeholder + real b-roll images |
| t ≈ 100–250 s | (Background) HeyGen completes. Real avatar hot-swaps into the video without reload |

The **visible** pipeline ends in ~70 s. The **complete** pipeline (with real
avatar) ends in 3–4 min. Demos are presentable inside the 70-second window;
the avatar hot-swap is bonus polish.

---

## What's NOT in the MVP (deferred for honesty)

- Production deploy to Fly.io (Dockerfile is ready but not deployed)
- Real social posting integrations (LinkedIn / Twitter / Instagram API)
- True multi-turn refinement chat (each user message = new full run today)
- Avatar IV trained avatars (HeyGen's longer-training custom avatar product)
- Brand book ingestion from PDF uploads
- Long-form output (10+ min YouTube videos) — currently tuned for ~12s Reels

These are all incremental additions, not architectural changes.

---

## Cost per demo (with paid keys)

| Item | Cost per run |
|---|---|
| Anthropic Sonnet 4.6 + Haiku 4.5 | ~$0.03–0.05 |
| Tavily research | ~$0.003 |
| OpenAI TTS-1 (~250 chars) | ~$0.0004 |
| Replicate Flux Schnell ×4 images | ~$0.012 |
| HeyGen avatar (~12s video, ~8 credits) | ~$0.40 (at $0.05/credit Pro plan) |
| **Total per demo** | **~$0.45** |

D-ID alternative: ~$0.10–0.30 per render depending on plan, total ~$0.15–0.35
per demo.

---

## Repo layout

```
cucu/
├── app/                     # Next.js App Router
│   ├── page.tsx             # 2-column UI shell
│   ├── api/
│   │   ├── run/             # POST start a run, GET snapshot
│   │   ├── stream/[id]/     # SSE event stream
│   │   ├── personas/        # GET examples + capability flags
│   │   └── studio/          # Photo + voice upload to HeyGen
│   ├── globals.css
│   └── layout.tsx           # Instrument Serif + Inter font loading
├── components/
│   ├── ChatPanel.tsx        # Left column — input + history + studio
│   ├── RunStage.tsx         # Right column — idle/progress/output/error
│   ├── MarketingComposition.tsx  # 9:16 split video composition
│   ├── StudioSheet.tsx      # Face + voice upload modal
│   ├── HistorySheet.tsx     # Run history modal
│   ├── useRun.ts            # Reducer-backed run state + SSE listener
│   ├── useStudioConfig.ts   # localStorage for face/voice IDs
│   ├── useChatHistory.ts    # In-session chat bubbles
│   ├── useRunHistory.ts     # localStorage for completed runs
│   └── ui/                  # shadcn primitives (button, card, dialog, tabs, ...)
├── lib/
│   ├── agents/
│   │   ├── coordinator.ts   # Stage orchestration
│   │   ├── researcher.ts    # Tavily + Haiku
│   │   ├── strategist.ts    # Sonnet JSON
│   │   ├── copywriters.ts   # Sonnet JSON, retry-with-fallback
│   │   └── art-director.ts  # Voice + images + avatar + composition
│   ├── adapters/
│   │   ├── llm.ts           # Anthropic SDK + JSON repair pass
│   │   ├── research.ts      # Tavily
│   │   ├── voice.ts         # OpenAI TTS + browser fallback
│   │   ├── avatar.ts        # HeyGen + D-ID + brand-emblem fallback
│   │   ├── image.ts         # Replicate Flux + branded gradient fallback
│   │   └── storage.ts       # FS or Supabase
│   ├── personas.ts          # deriveBrand() + example briefs
│   ├── platforms.ts         # Instagram/YouTube/LinkedIn/X format rules
│   ├── store.ts             # In-memory run state + SSE pub/sub
│   └── types.ts             # Shared types
├── data/
│   └── runs/                # Persisted run JSON snapshots
├── public/generated/        # Audio mp3s, avatar mp4s, image PNGs
├── Dockerfile               # Multi-stage Next.js standalone build
├── fly.toml                 # Fly.io deploy config
├── .env.example             # All env vars documented
├── README.md                # Dev setup
└── DEMO.md                  # ← this file
```

---

## Setup quick reference

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in keys you have — every adapter has a working mock fallback

# 3. Run
npm run dev          # localhost:3000
```

Required for the real flow: `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`,
`OPENAI_API_KEY`. Recommended: `REPLICATE_API_TOKEN`, `DID_API_KEY` _(or
`HEYGEN_API_KEY` if you've got API credits on the plan)_.
