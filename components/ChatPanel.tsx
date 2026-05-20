"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  CheckCircle2,
  History,
  Loader2,
  Mic2,
  Sparkles,
  UserCircle2,
  Wand2,
} from "lucide-react";
import type { ContentRun, RunStage, StudioConfig } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { StudioSheet } from "@/components/StudioSheet";
import { HistorySheet } from "@/components/HistorySheet";
import type { ChatMessage } from "@/components/useChatHistory";
import type { HistoryEntry } from "@/components/useRunHistory";
import { cn } from "@/lib/utils";

interface Props {
  examples: Array<{ label: string; text: string }>;
  messages: ChatMessage[];
  running: boolean;
  activeRunId: string | null;
  onSend: (message: string) => void;
  capabilities: {
    hasAnthropic: boolean;
    hasTavily: boolean;
    hasTTS: boolean;
    hasAvatar: boolean;
    hasReplicate: boolean;
    hasSupabase: boolean;
    hasVoiceClone: boolean;
  } | null;
  studioConfig: StudioConfig | null;
  onStudioChange: (next: StudioConfig | null) => void;
  history: HistoryEntry[];
  onLoadFromHistory: (run: ContentRun) => void;
  onRemoveFromHistory: (id: string) => void;
  onClearHistory: () => void;
}

const CAP_LABELS: Record<keyof NonNullable<Props["capabilities"]> & string, string> = {
  hasAnthropic: "Claude",
  hasTavily: "Tavily",
  hasTTS: "Voice",
  hasAvatar: "Avatar",
  hasReplicate: "Images",
  hasSupabase: "Supabase",
  hasVoiceClone: "Voice clone",
};

const STAGE_LIVE_LABEL: Record<RunStage, string> = {
  queued: "Starting up",
  researching: "Researching the niche",
  strategizing: "Designing the strategy",
  writing: "Writing four platform drafts",
  voicing: "Generating voice",
  rendering: "Rendering avatar",
  composing: "Composing platform variants",
  done: "Done",
  error: "Errored",
};

export function ChatPanel({
  examples,
  messages,
  running,
  activeRunId,
  onSend,
  capabilities,
  studioConfig,
  onStudioChange,
  history,
  onLoadFromHistory,
  onRemoveFromHistory,
  onClearHistory,
}: Props) {
  const [draft, setDraft] = useState("");
  const [studioOpen, setStudioOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const studioActive = !!(studioConfig?.talkingPhotoId || studioConfig?.voiceId);
  const isEmpty = messages.length === 0;

  // Auto-grow textarea up to a cap
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(180, el.scrollHeight) + "px";
  }, [draft]);

  // Auto-scroll to bottom on new messages or stage updates
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.role === "cucu" && (messages[messages.length - 1] as Extract<ChatMessage, { role: "cucu" }>).stage]);

  function submit() {
    const text = draft.trim();
    if (!text || running) return;
    onSend(text);
    setDraft("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display text-xl text-ink-800 leading-none">Chat</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHistoryOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors",
                history.length > 0
                  ? "border-ink-200 bg-cream-100 text-ink-700 hover:bg-cream-200"
                  : "border-ink-100 bg-cream-100/60 text-ink-400 hover:bg-cream-100",
              )}
              title="Past runs"
            >
              <History size={10} />
              History
              {history.length > 0 && (
                <span className="text-ink-500 font-bold">
                  {history.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setStudioOpen(true)}
              disabled={running}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors",
                studioActive
                  ? "border-signal-300 bg-signal-50 text-signal-700 hover:bg-signal-100"
                  : "border-ink-200 bg-cream-100 text-ink-500 hover:bg-cream-200",
                running && "opacity-60 cursor-not-allowed",
              )}
              title="Upload your face and clone your voice"
            >
              <Wand2 size={10} />
              Studio
              {studioActive && <span className="h-1 w-1 rounded-full bg-signal-500" />}
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-500">
          Send a brief — cucu researches, writes, voices, and renders one Instagram Reel.
        </p>
      </div>

      <StudioSheet
        open={studioOpen}
        onOpenChange={setStudioOpen}
        config={studioConfig}
        onChange={onStudioChange}
        voiceCloneEnabled={capabilities?.hasVoiceClone ?? false}
      />

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        onLoad={onLoadFromHistory}
        onRemove={onRemoveFromHistory}
        onClear={onClearHistory}
      />

      {studioActive && (
        <div className="rounded-xl border border-signal-200 bg-signal-50/40 px-3 py-2 flex items-center gap-3 shrink-0">
          {studioConfig?.talkingPhotoId && (
            <div className="flex items-center gap-1.5 text-[11px] text-signal-700">
              <UserCircle2 size={12} />
              <span className="font-medium">Your face</span>
            </div>
          )}
          {studioConfig?.talkingPhotoId && studioConfig?.voiceId && (
            <span className="h-1 w-1 rounded-full bg-signal-400" />
          )}
          {studioConfig?.voiceId && (
            <div className="flex items-center gap-1.5 text-[11px] text-signal-700">
              <Mic2 size={12} />
              <span className="font-medium">Your voice</span>
            </div>
          )}
          <button
            onClick={() => setStudioOpen(true)}
            className="ml-auto text-[10.5px] uppercase tracking-wider text-ink-500 hover:text-ink-800"
          >
            Edit
          </button>
        </div>
      )}

      {/* Message list — fills available height */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 -mr-1 space-y-3"
      >
        {isEmpty && <EmptyHint examples={examples} onPick={(t) => setDraft(t)} />}

        <AnimatePresence initial={false}>
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <CucuBubble
                key={m.id}
                message={m}
                isActive={m.runId === activeRunId}
              />
            ),
          )}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="shrink-0">
        <div
          className={cn(
            "rounded-2xl border bg-white relative overflow-hidden transition-colors",
            running
              ? "border-signal-300 shadow-[0_0_0_3px_rgba(242,64,22,0.08)]"
              : "border-ink-100",
          )}
        >
          <Textarea
            ref={textareaRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isEmpty
                ? "Try: a strength coach for working women 30-45, no influencer fluff."
                : "Send another brief…"
            }
            disabled={running}
            className="w-full border-0 bg-transparent text-[13.5px] leading-relaxed text-ink-800 placeholder:text-ink-300 focus-visible:ring-0 focus-visible:border-0 px-4 pt-3 pb-11 disabled:opacity-60"
            style={{ minHeight: "84px" }}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {running && (
              <span className="text-[10px] text-signal-700 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" />
                running
              </span>
            )}
            {!running && draft.trim() && (
              <span className="hidden sm:inline text-[10px] text-ink-300">
                ⌘ + Enter
              </span>
            )}
            <button
              onClick={submit}
              disabled={!draft.trim() || running}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                draft.trim() && !running
                  ? "bg-ink-800 text-cream-50 hover:bg-ink-700"
                  : "bg-ink-100 text-ink-300 cursor-not-allowed",
              )}
              aria-label="Send"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {capabilities && (
          <div className="mt-2.5 rounded-xl border border-ink-100 bg-cream-100/60 p-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              {Object.entries(capabilities).map(([key, on]) => (
                <div key={key} className="flex items-center gap-1 text-[10px] text-ink-500">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      on
                        ? "bg-signal-500 shadow-[0_0_6px_rgba(242,64,22,0.45)]"
                        : "bg-ink-200",
                    )}
                  />
                  <span className={cn("font-medium", on ? "text-ink-700" : "text-ink-400")}>
                    {CAP_LABELS[key as keyof typeof CAP_LABELS]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── bubbles ────────────────────────── */

function UserBubble({ message }: { message: Extract<ChatMessage, { role: "user" }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-800 text-cream-50 px-3.5 py-2.5 text-[13px] leading-relaxed shadow-[0_2px_0_rgba(30,12,10,0.06)]">
        {message.text}
      </div>
    </motion.div>
  );
}

function CucuBubble({
  message,
  isActive,
}: {
  message: Extract<ChatMessage, { role: "cucu" }>;
  isActive: boolean;
}) {
  const done = message.stage === "done";
  const errored = message.stage === "error";
  const working = !done && !errored;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex"
    >
      <div className="max-w-[92%] w-full">
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <span className="font-display text-[14px] text-ink-700 leading-none">
            cucu
          </span>
          {working && (
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-signal-700 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-500 animate-pulse" />
              live
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl rounded-bl-md border bg-white px-3.5 py-3 text-[13px] leading-relaxed text-ink-800",
            isActive && working && "border-signal-200 shadow-[0_2px_24px_-12px_rgba(242,64,22,0.25)]",
            !isActive && "border-ink-100",
            errored && "border-red-200",
          )}
        >
          {/* Persona pill (if derived) */}
          {message.persona && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 border border-ink-100 px-2 py-0.5 mb-2 text-[10.5px]">
              <span
                className="h-3.5 w-3.5 rounded-sm flex items-center justify-center text-[10px]"
                style={{
                  background: `linear-gradient(135deg, ${message.persona.primaryColor}28, ${message.persona.accentColor}40)`,
                }}
              >
                {message.persona.emoji}
              </span>
              <span className="text-ink-700 font-medium">{message.persona.name}</span>
            </div>
          )}

          {/* Stage live status */}
          {working && (
            <div className="text-ink-600 italic">
              {STAGE_LIVE_LABEL[message.stage]}…
            </div>
          )}

          {/* Hero angle (after strategy) */}
          {message.hero && (
            <p className="font-display text-[18px] leading-snug text-ink-800 text-balance mt-1">
              <span className="ink-underline">{message.hero}</span>
            </p>
          )}

          {/* Done — single video ready */}
          {done && message.videoCount && message.videoCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <CheckCircle2 size={12} />
              Instagram Reel ready · check the right panel
            </div>
          )}

          {/* Error */}
          {errored && (
            <div className="mt-1.5 text-[11.5px] text-red-700">
              {message.error ?? "Run failed"}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyHint({
  examples,
  onPick,
}: {
  examples: Props["examples"];
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-2xl border border-ink-100 bg-white p-4 flex gap-3">
        <div className="h-8 w-8 rounded-full bg-signal-500 text-white flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={14} />
        </div>
        <div className="flex-1">
          <div className="font-display text-lg text-ink-800 leading-tight">
            Hey. What should I make?
          </div>
          <p className="text-[12px] text-ink-500 leading-snug mt-1">
            A brand, a URL, a topic. Plain English. I'll derive a persona, run research, write four platform drafts, voice them, and render an avatar.
          </p>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 px-1 mt-1">
        Or try
      </div>
      {examples.slice(0, 3).map((ex) => (
        <button
          key={ex.label}
          onClick={() => onPick(ex.text)}
          className="text-left rounded-xl border border-ink-100 bg-white hover:border-ink-300 px-3 py-2.5 transition-colors group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-ink-800 truncate">
              {ex.label}
            </span>
            <Sparkles
              size={11}
              className="text-ink-300 group-hover:text-signal-500 transition-colors shrink-0"
            />
          </div>
          <p className="text-[10.5px] text-ink-400 mt-0.5 line-clamp-2 leading-snug">
            {ex.text}
          </p>
        </button>
      ))}
    </div>
  );
}
