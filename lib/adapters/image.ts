import { env, capabilities } from "../env";
import { storage } from "./storage";
import { hashString } from "../utils";

export interface ImageRequest {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  personaId?: string;
  /** Brand colors used by the gradient placeholder when Replicate fails */
  brandColors?: { primary: string; accent: string };
}

export interface ImageResult {
  url: string;
  cached: boolean;
  provider: "replicate" | "mock";
}

export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const cacheKey = `images/${hashString(req.prompt + (req.aspectRatio ?? "1:1"))}.png`;
  const cached = await storage.get(cacheKey);
  if (cached) return { url: cached, cached: true, provider: "replicate" };

  if (!capabilities.hasReplicate) {
    return { url: gradientPlaceholder(req), cached: false, provider: "mock" };
  }

  // Replicate's free tier rate-limits aggressively. We retry up to 4 times with
  // exponential backoff (4s → 8s → 16s → 32s) and honor any Retry-After header.
  // 429s on free tier can take 30+ seconds to clear.
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const create = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.replicateToken}`,
          "content-type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: req.prompt,
            aspect_ratio: req.aspectRatio ?? "1:1",
            num_outputs: 1,
            output_format: "png",
          },
        }),
      });

      // 429 → back off and retry. Honor server's Retry-After if present, else exponential.
      if (create.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryAfter = create.headers.get("retry-after");
        const serverWait = retryAfter ? Math.min(60000, parseInt(retryAfter, 10) * 1000) : 0;
        const backoff = serverWait || Math.min(32000, 4000 * Math.pow(2, attempt - 1));
        console.log(`Replicate 429 (attempt ${attempt}/${MAX_ATTEMPTS}) — backing off ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!create.ok) throw new Error(`Replicate ${create.status}`);
      const j = (await create.json()) as { output: string | string[] };
      const url = Array.isArray(j.output) ? j.output[0] : j.output;
      if (!url) throw new Error("Replicate returned no output URL");
      const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
      const stored = await storage.put(cacheKey, bin, "image/png");
      return { url: stored, cached: false, provider: "replicate" };
    } catch (e) {
      if (attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(16000, 2000 * Math.pow(2, attempt - 1));
        console.log(`Replicate error (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.warn("Replicate failed after retries, using gradient placeholder", e);
      return { url: gradientPlaceholder(req), cached: false, provider: "mock" };
    }
  }
  return { url: gradientPlaceholder(req), cached: false, provider: "mock" };
}

/**
 * Branded placeholder used when Replicate isn't available. Uses persona colors
 * when provided so the b-roll backdrop still feels intentional. Each prompt
 * gets a slightly different composition driven by a hash of the prompt text,
 * so the three b-roll beats look distinct.
 */
function gradientPlaceholder(req: ImageRequest): string {
  const aspect = req.aspectRatio ?? "1:1";
  const [w, h] =
    aspect === "16:9" ? [1600, 900] : aspect === "9:16" ? [900, 1600] : [1200, 1200];

  const seed = hashString(req.prompt);
  // Two integers 0..255 derived from the hash → drive composition variance per prompt
  const v1 = parseInt(seed.slice(0, 2), 16) || 64;
  const v2 = parseInt(seed.slice(2, 4), 16) || 192;
  // Hash also drives gradient axis + light position so each beat differs
  const angle = (v1 / 255) * 360;
  const cx = 15 + (v2 % 70);
  const cy = 15 + (v1 % 70);

  const primary = req.brandColors?.primary ?? `#${seed.slice(0, 6)}`;
  const accent = req.brandColors?.accent ?? `#${seed.slice(6, 12)}`;
  // Darker companion for depth
  const dark = "#0e0c0a";

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <linearGradient id='g' gradientTransform='rotate(${angle})'>
        <stop offset='0' stop-color='${primary}'/>
        <stop offset='0.55' stop-color='${accent}'/>
        <stop offset='1' stop-color='${dark}'/>
      </linearGradient>
      <radialGradient id='r' cx='${cx}%' cy='${cy}%' r='60%'>
        <stop offset='0' stop-color='white' stop-opacity='0.55'/>
        <stop offset='0.5' stop-color='${accent}' stop-opacity='0.25'/>
        <stop offset='1' stop-color='${primary}' stop-opacity='0'/>
      </radialGradient>
      <filter id='grain'>
        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${v1}'/>
        <feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0'/>
      </filter>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <rect width='100%' height='100%' fill='url(#r)'/>
    <rect width='100%' height='100%' filter='url(#grain)'/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
