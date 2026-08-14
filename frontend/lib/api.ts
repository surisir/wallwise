import { AnalysisResult } from "@/types/analysis";
import { hexRgb } from "./color";
// Keep API calls same-origin so a single Cloudflare tunnel to Next.js is enough.
// Next.js rewrites this path server-side to the private FastAPI process.
const API_URL = "/api/backend";
export async function analyzeRoom(file: File): Promise<AnalysisResult> {
  const form = new FormData(); form.append("image", file);
  const response = await fetch(`${API_URL}/analyze`, { method: "POST", body: form });
  const rawBody = await response.text();
  const body = rawBody ? safeJson(rawBody) : {};
  if (!response.ok) throw new Error(body.detail || rawBody || `Image analysis failed with ${response.status} ${response.statusText}.`);
  if (!body.image || !Array.isArray(body.walls) || !Array.isArray(body.objects)) throw new Error("The analysis response was incomplete.");
  return body as AnalysisResult;
}

export async function visualizeWallColor(file: File, color: { hex: string; name?: string; aiOnly?: boolean; areaIds?: string[]; targetPoints?: { id: string; x: number; y: number }[]; lightingValue?: number; lightingLabel?: string }): Promise<Blob> {
  const form = new FormData();
  form.append("image", file);
  form.append("color_hex", color.hex);
  form.append("color_rgb", hexRgb(color.hex).join(","));
  if (color.name) form.append("color_name", color.name);
  if (typeof color.lightingValue === "number") form.append("lighting_value", String(color.lightingValue));
  if (color.lightingLabel) form.append("lighting_label", color.lightingLabel);
  if (color.aiOnly) form.append("ai_only", "true");
  if (color.areaIds?.length) form.append("selected_area_ids", JSON.stringify(color.areaIds));
  if (color.targetPoints?.length) form.append("target_points", JSON.stringify(color.targetPoints));
  const response = await fetch(`${API_URL}/visualize`, { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "We couldn’t create your wall-color visualization.");
  }
  return response.blob();
}

function safeJson(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
