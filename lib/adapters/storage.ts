import { promises as fs } from "fs";
import path from "path";
import { env, capabilities } from "../env";

/**
 * Tiny storage abstraction. Stores binary blobs (audio/video/images) and JSON.
 * - Local: writes to public/generated so files are served by Next directly.
 * - Supabase: uses the storage REST API when keys are present.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public", "generated");
const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const storage = {
  /** Returns the public URL if the asset already exists, else null. */
  async get(key: string): Promise<string | null> {
    if (capabilities.hasSupabase) {
      const url = `${env.supabaseUrl}/storage/v1/object/public/generated/${key}`;
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (head.ok) return url;
      } catch {
        /* fall through */
      }
      return null;
    }
    const full = path.join(PUBLIC_DIR, key);
    try {
      await fs.access(full);
      return `/generated/${key}`;
    } catch {
      return null;
    }
  },

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    if (capabilities.hasSupabase) {
      const url = `${env.supabaseUrl}/storage/v1/object/generated/${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.supabaseKey}`,
          "content-type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(data),
      });
      if (!res.ok) throw new Error(`Supabase storage put failed ${res.status}`);
      return `${env.supabaseUrl}/storage/v1/object/public/generated/${key}`;
    }

    const full = path.join(PUBLIC_DIR, key);
    await ensureDir(path.dirname(full));
    await fs.writeFile(full, data);
    return `/generated/${key}`;
  },

  /** Run state JSON persistence (lightweight, replaces brand_profiles/content_runs tables). */
  async putJSON(key: string, value: unknown): Promise<void> {
    const full = path.join(DATA_DIR, `${key}.json`);
    await ensureDir(path.dirname(full));
    await fs.writeFile(full, JSON.stringify(value, null, 2));
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const full = path.join(DATA_DIR, `${key}.json`);
    try {
      const txt = await fs.readFile(full, "utf-8");
      return JSON.parse(txt) as T;
    } catch {
      return null;
    }
  },
};
