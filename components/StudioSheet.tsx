"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  CheckCircle2,
  ImageUp,
  Loader2,
  Mic2,
  Trash2,
  Upload,
  UserCircle2,
} from "lucide-react";
import type { StudioConfig } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: StudioConfig | null;
  onChange: (config: StudioConfig | null) => void;
  trigger?: React.ReactNode;
}

export function StudioSheet({ open, onOpenChange, config, onChange, trigger }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="p-0 overflow-hidden">
        <div className="p-5 pb-3 border-b border-ink-100">
          <DialogTitle>Studio</DialogTitle>
          <DialogDescription className="mt-1">
            Upload your face and clone your voice. cucu will use them for every render until you clear them.
          </DialogDescription>
        </div>

        <Tabs defaultValue="photo" className="flex flex-col">
          <div className="px-5 pt-4">
            <TabsList>
              <TabsTrigger value="photo" className="gap-1.5">
                <UserCircle2 size={12} /> Your face
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5">
                <Mic2 size={12} /> Your voice
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="photo" className="px-5 py-5 mt-0">
            <PhotoTab config={config} onChange={onChange} />
          </TabsContent>
          <TabsContent value="voice" className="px-5 py-5 mt-0">
            <VoiceTab config={config} onChange={onChange} />
          </TabsContent>
        </Tabs>

        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-cream-100/50">
          <span className="text-[10.5px] text-ink-400">
            HeyGen plan must support Talking Photo / Voice Clone
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────── */

function PhotoTab({
  config,
  onChange,
}: {
  config: StudioConfig | null;
  onChange: (c: StudioConfig | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Clean up object URLs on unmount
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/studio/photo", { method: "POST", body: fd });
      const json = (await res.json()) as {
        talkingPhotoId?: string;
        talkingPhotoUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.talkingPhotoId) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      onChange({
        ...(config ?? {}),
        talkingPhotoId: json.talkingPhotoId,
        talkingPhotoLabel: file.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    setPreviewUrl(null);
    const next = { ...(config ?? {}) };
    delete next.talkingPhotoId;
    delete next.talkingPhotoLabel;
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  const hasPhoto = !!config?.talkingPhotoId;

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-600 leading-relaxed">
        Drop a clean head-and-shoulders photo. cucu submits it to HeyGen Talking Photo
        and uses the returned avatar for every render.
      </div>

      <AnimatePresence mode="wait">
        {hasPhoto ? (
          <motion.div
            key="set"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-ink-200 bg-white p-4 flex items-start gap-4"
          >
            <div className="h-20 w-20 rounded-xl bg-cream-100 border border-ink-100 overflow-hidden flex items-center justify-center shrink-0">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle2 size={32} className="text-ink-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="success" className="mb-1.5">
                <CheckCircle2 size={9} className="mr-1" /> Talking photo set
              </Badge>
              <div className="text-[12px] font-medium text-ink-800 truncate">
                {config?.talkingPhotoLabel ?? "Uploaded photo"}
              </div>
              <div className="text-[10.5px] text-ink-400 mt-0.5 truncate">
                ID: {config?.talkingPhotoId}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPhoto}
                className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 -ml-2"
              >
                <Trash2 size={12} /> Remove
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.label
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            htmlFor="studio-photo"
            className={cn(
              "block rounded-xl border-2 border-dashed border-ink-200 bg-cream-50 p-8 text-center cursor-pointer hover:border-signal-400 hover:bg-signal-50/30 transition-colors",
              uploading && "opacity-60 cursor-wait",
            )}
          >
            <div className="flex flex-col items-center gap-2">
              {uploading ? (
                <Loader2 size={26} className="text-signal-500 animate-spin" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white border border-ink-100 flex items-center justify-center text-ink-500">
                  <ImageUp size={22} />
                </div>
              )}
              <div className="font-display text-lg text-ink-800 leading-none mt-1">
                {uploading ? "Uploading to HeyGen…" : "Drop your face"}
              </div>
              <div className="text-[11px] text-ink-400 max-w-[20rem]">
                JPEG, PNG, or WebP · up to 8 MB · facing camera, neutral expression works best
              </div>
            </div>
            <input
              id="studio-photo"
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </motion.label>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function VoiceTab({
  config,
  onChange,
}: {
  config: StudioConfig | null;
  onChange: (c: StudioConfig | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    // Measure duration so we can warn if too short
    try {
      const dur = await measureAudioDuration(localUrl);
      setDuration(dur);
    } catch {
      setDuration(null);
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/studio/voice", { method: "POST", body: fd });
      const json = (await res.json()) as {
        voiceId?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok || !json.voiceId) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      onChange({
        ...(config ?? {}),
        voiceId: json.voiceId,
        voiceLabel: json.name ?? file.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function clearVoice() {
    setPreviewUrl(null);
    setDuration(null);
    const next = { ...(config ?? {}) };
    delete next.voiceId;
    delete next.voiceLabel;
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  const hasVoice = !!config?.voiceId;

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-600 leading-relaxed">
        Upload 30–60 seconds of clean speech (your voice, one speaker, no music).
        cucu sends it to HeyGen Instant Voice Clone.
      </div>

      <AnimatePresence mode="wait">
        {hasVoice ? (
          <motion.div
            key="set"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-ink-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-signal-50 border border-signal-200 flex items-center justify-center text-signal-600 shrink-0">
                <AudioLines size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <Badge variant="success" className="mb-1.5">
                  <CheckCircle2 size={9} className="mr-1" /> Voice clone set
                </Badge>
                <div className="text-[12px] font-medium text-ink-800 truncate">
                  {config?.voiceLabel ?? "Cloned voice"}
                </div>
                <div className="text-[10.5px] text-ink-400 mt-0.5 truncate">
                  Voice ID: {config?.voiceId}
                </div>
                {previewUrl && (
                  <audio
                    src={previewUrl}
                    controls
                    className="mt-2 w-full h-8"
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearVoice}
                  className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 -ml-2"
                >
                  <Trash2 size={12} /> Remove
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.label
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            htmlFor="studio-voice"
            className={cn(
              "block rounded-xl border-2 border-dashed border-ink-200 bg-cream-50 p-8 text-center cursor-pointer hover:border-signal-400 hover:bg-signal-50/30 transition-colors",
              uploading && "opacity-60 cursor-wait",
            )}
          >
            <div className="flex flex-col items-center gap-2">
              {uploading ? (
                <Loader2 size={26} className="text-signal-500 animate-spin" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-white border border-ink-100 flex items-center justify-center text-ink-500">
                  <Upload size={22} />
                </div>
              )}
              <div className="font-display text-lg text-ink-800 leading-none mt-1">
                {uploading ? "Cloning voice…" : "Drop a voice sample"}
              </div>
              <div className="text-[11px] text-ink-400 max-w-[22rem]">
                MP3, WAV, M4A, OGG · up to 20 MB · 30–60s of clean speech, one speaker
              </div>
              {duration !== null && (
                <div className="text-[10.5px] text-ink-500 mt-1">
                  Detected {Math.round(duration)}s of audio
                </div>
              )}
            </div>
            <input
              id="studio-voice"
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </motion.label>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function measureAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(a.duration || 0);
    a.onerror = () => reject(new Error("failed to read audio metadata"));
    a.src = url;
  });
}
