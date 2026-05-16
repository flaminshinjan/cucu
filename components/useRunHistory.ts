"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContentRun } from "@/lib/types";

const STORAGE_KEY = "cucu.history.v1";
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  savedAt: number;
  run: ContentRun;
}

/**
 * Persist completed runs to localStorage so the user can revisit past
 * generations without re-running the pipeline. We keep the most recent
 * MAX_ENTRIES entries, newest first.
 */
export function useRunHistory(): {
  history: HistoryEntry[];
  saveRun: (run: ContentRun) => void;
  removeRun: (id: string) => void;
  clear: () => void;
} {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as HistoryEntry[];
      if (Array.isArray(parsed)) setHistory(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const saveRun = useCallback(
    (run: ContentRun) => {
      // Dedupe by run id — saving the same run twice updates it in place
      setHistory((prev) => {
        const filtered = prev.filter((e) => e.run.id !== run.id);
        const entry: HistoryEntry = {
          id: run.id,
          savedAt: Date.now(),
          run,
        };
        const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const removeRun = useCallback(
    (id: string) => {
      persist(history.filter((e) => e.id !== id));
    },
    [history, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { history, saveRun, removeRun, clear };
}
