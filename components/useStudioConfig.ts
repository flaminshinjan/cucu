"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioConfig } from "@/lib/types";

const STORAGE_KEY = "cucu.studio.v1";

/** Persists the user's HeyGen studio config (talking photo + voice clone IDs) in localStorage. */
export function useStudioConfig(): {
  config: StudioConfig | null;
  setConfig: (next: StudioConfig | null) => void;
} {
  const [config, setConfigState] = useState<StudioConfig | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setConfigState(JSON.parse(raw) as StudioConfig);
    } catch {
      /* ignore */
    }
  }, []);

  const setConfig = useCallback((next: StudioConfig | null) => {
    setConfigState(next);
    try {
      if (next && Object.keys(next).length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return { config, setConfig };
}
