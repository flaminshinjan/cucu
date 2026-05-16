"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, History, Play, Trash2 } from "lucide-react";
import type { ContentRun } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/components/useRunHistory";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryEntry[];
  onLoad: (run: ContentRun) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function HistorySheet({
  open,
  onOpenChange,
  history,
  onLoad,
  onRemove,
  onClear,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-2xl">
        <div className="p-5 pb-3 border-b border-ink-100 flex items-center justify-between gap-3">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <History size={16} className="text-signal-500" />
              History
            </DialogTitle>
            <DialogDescription className="mt-1">
              {history.length === 0
                ? "Past generations will appear here once you've run cucu."
                : `${history.length} saved ${history.length === 1 ? "run" : "runs"} · click to reopen`}
            </DialogDescription>
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-ink-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} /> Clear all
            </Button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-3 space-y-2">
          {history.length === 0 && (
            <div className="text-center py-12 text-ink-400 text-sm">
              No history yet.
            </div>
          )}
          <AnimatePresence initial={false}>
            {history.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onLoad={(run) => {
                  onLoad(run);
                  onOpenChange(false);
                }}
                onRemove={onRemove}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-cream-100/50">
          <span className="text-[10.5px] text-ink-400">
            Stored locally · up to 20 most recent runs
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryRow({
  entry,
  onLoad,
  onRemove,
}: {
  entry: HistoryEntry;
  onLoad: (run: ContentRun) => void;
  onRemove: (id: string) => void;
}) {
  const r = entry.run;
  const persona = r.persona;
  const hero = r.strategy?.hero?.angle;
  const message = r.message;
  const compCount = r.compositions?.length ?? 0;
  const when = formatWhen(entry.savedAt);
  const avatarIsReal =
    r.assets?.avatarVideoUrl &&
    !r.assets.avatarVideoUrl.startsWith("client://");

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-ink-100 bg-white hover:border-ink-300 transition-colors group"
    >
      <button
        onClick={() => onLoad(r)}
        className="w-full text-left p-3.5 flex items-start gap-3"
      >
        {persona && (
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 ring-1 ring-ink-100"
            style={{
              background: `linear-gradient(135deg, ${persona.primaryColor}22, ${persona.accentColor}38)`,
            }}
          >
            {persona.emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display text-[15px] text-ink-800 truncate">
              {persona?.name ?? "Untitled"}
            </span>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-400">
              <Clock size={9} /> {when}
            </span>
          </div>
          {hero ? (
            <p className="text-[12.5px] text-ink-700 leading-snug line-clamp-2">
              {hero}
            </p>
          ) : (
            <p className="text-[12px] text-ink-500 leading-snug line-clamp-2">
              {message}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-400">
            <span>
              {compCount} {compCount === 1 ? "video" : "videos"}
            </span>
            <span className="h-1 w-1 rounded-full bg-ink-300" />
            <span className={avatarIsReal ? "text-emerald-600 font-medium" : ""}>
              {avatarIsReal ? "Real avatar" : "Brand emblem"}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 text-cream-50 px-2 py-1 text-[10px] uppercase tracking-wider font-semibold">
            <Play size={9} /> Open
          </span>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.id);
        }}
        className={cn(
          "absolute hidden",
          "h-7 w-7 rounded-full bg-white hover:bg-red-50 text-red-600 border border-ink-100",
        )}
        aria-label="Remove"
        title="Remove"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
