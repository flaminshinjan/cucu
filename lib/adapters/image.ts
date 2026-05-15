import { env, capabilities } from "../env";
import { storage } from "./storage";
import { hashString } from "../utils";

export interface ImageRequest {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  personaId?: string;
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
    if (!create.ok) throw new Error(`Replicate ${create.status}`);
    const j = (await create.json()) as { output: string | string[] };
    const url = Array.isArray(j.output) ? j.output[0] : j.output;
    const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
    const stored = await storage.put(cacheKey, bin, "image/png");
    return { url: stored, cached: false, provider: "replicate" };
  } catch (e) {
    console.warn("Replicate failed, using gradient placeholder", e);
    return { url: gradientPlaceholder(req), cached: false, provider: "mock" };
  }
}

/** Deterministic gradient URL so the UI can render without bundled assets */
function gradientPlaceholder(req: ImageRequest): string {
  const seed = hashString(req.prompt).slice(0, 6);
  // Returns a data URL of a stylish gradient SVG — visually credible as a thumbnail
  const aspect = req.aspectRatio ?? "1:1";
  const [w, h] =
    aspect === "16:9" ? [1600, 900] : aspect === "9:16" ? [900, 1600] : [1200, 1200];
  const c1 = `#${seed.slice(0, 3)}f`;
  const c2 = `#${seed.slice(3, 6)}a`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${c1}'/>
        <stop offset='1' stop-color='${c2}'/>
      </linearGradient>
      <radialGradient id='r' cx='30%' cy='25%' r='70%'>
        <stop offset='0' stop-color='white' stop-opacity='0.35'/>
        <stop offset='1' stop-color='white' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <rect width='100%' height='100%' fill='url(#r)'/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
