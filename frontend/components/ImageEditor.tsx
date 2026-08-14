"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisResult } from "@/types/analysis";
import { clientToImagePoint } from "@/lib/canvas";
import { visualizeWallColor } from "@/lib/api";
import { ColorPanel } from "./ColorPanel";
import { ColorPickerModal, PickedColor } from "./ColorPickerModal";

type Props = { originalSource: string; originalFile: File; analysis: AnalysisResult; onStartOver: () => void };
type Point = { x: number; y: number };
type DisplayMode = "original" | "ai-result";
type SelectedPaint = { hex: string; name?: string; brand?: string; shadeName?: string; code?: string };
type GenerateOptions = { lightingValue?: number; lightingLabel?: string; loadingText?: string };

async function decodeMask(mask: string, width: number, height: number): Promise<ImageData> {
  const image = new Image();
  image.src = `data:image/png;base64,${mask}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function markerFor(wall: AnalysisResult["walls"][number], analysisSize: AnalysisResult["image"], targetSize = analysisSize): Point {
  const scaleX = targetSize.width / Math.max(1, analysisSize.width);
  const scaleY = targetSize.height / Math.max(1, analysisSize.height);
  return {
    x: Math.round((wall.boundingBox.x1 + wall.boundingBox.x2) / 2 * scaleX),
    y: Math.round((wall.boundingBox.y1 + wall.boundingBox.y2) / 2 * scaleY),
  };
}

function extensionFor(type: string) {
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

function lightingLabelFor(value: number) {
  if (value <= 20) return "Night / artificial light";
  if (value <= 40) return "Evening warm light";
  if (value <= 60) return "Natural light";
  if (value <= 80) return "Bright daylight";
  return "Direct sunlight";
}

function lightingPreviewFilter(value: number) {
  const normalized = Math.max(0, Math.min(100, value));
  if (normalized < 50) {
    const amount = (50 - normalized) / 50;
    const brightness = 1 - amount * 0.34;
    const saturation = 1 - amount * 0.16;
    const sepia = amount * 0.22;
    const contrast = 1 - amount * 0.04;
    return `brightness(${brightness}) saturate(${saturation}) sepia(${sepia}) contrast(${contrast})`;
  }
  const amount = (normalized - 50) / 50;
  const brightness = 1 + amount * 0.22;
  const saturation = 1 + amount * 0.1;
  const sepia = amount * 0.08;
  const contrast = 1 + amount * 0.06;
  return `brightness(${brightness}) saturate(${saturation}) sepia(${sepia}) contrast(${contrast})`;
}

const LIGHTING_PRESETS = [
  { label: "Natural / Same as photo", value: 50 },
  { label: "Direct Sunlight", value: 95 },
  { label: "Evening / Warm light", value: 35 },
  { label: "Night / Artificial light", value: 10 },
] as const;

export function ImageEditor({ originalSource, originalFile, analysis, onStartOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const masks = useRef<Record<string, ImageData>>({});
  const latestResultBlob = useRef<Blob | null>(null);

  const [ready, setReady] = useState(false);
  const [selectedColor, setSelectedColor] = useState<SelectedPaint | null>(null);
  const [selectedWalls, setSelectedWalls] = useState<string[]>(analysis.walls.map(wall => wall.id));
  const [hoverWall, setHoverWall] = useState<string | null>(null);
  const [editedSource, setEditedSource] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("original");
  const [visualizing, setVisualizing] = useState(false);
  const [visualizingText, setVisualizingText] = useState("Applying color…");
  const [visualizeError, setVisualizeError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [lightingValue, setLightingValue] = useState(50);
  const [finalizedLightingValue, setFinalizedLightingValue] = useState(50);

  const displaySource = displayMode === "ai-result" && editedSource ? editedSource : originalSource;
  const areaCount = analysis.walls.length;
  const allAreasSelected = areaCount > 0 && selectedWalls.length === areaCount;
  const visibleMarkers = displayMode === "original";
  const lightingLabel = lightingLabelFor(lightingValue);
  const hasLightingPreview = displayMode === "ai-result" && Boolean(editedSource) && lightingValue !== finalizedLightingValue;
  const canvasFilter = hasLightingPreview ? lightingPreviewFilter(lightingValue) : "none";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !ready) return;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);

    if (!visibleMarkers) return;

    analysis.walls.forEach((wall, index) => {
      const selected = selectedWalls.includes(wall.id);
      const hovered = hoverWall === wall.id;
      const marker = markerFor(wall, analysis.image, { width: canvas.width, height: canvas.height });
      const radius = hovered ? 18 : 15;

      context.save();
      context.globalAlpha = selected ? 1 : 0.72;
      context.fillStyle = selected ? "#18211d" : "#ffffff";
      context.strokeStyle = selected ? "#ffffff" : "#18211d";
      context.lineWidth = Math.max(2, Math.round(canvas.width / 480));
      context.beginPath();
      context.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = selected ? "#ffffff" : "#18211d";
      context.font = `700 ${Math.max(12, radius)}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(selected ? "✓" : `${index + 1}`, marker.x, marker.y + 0.5);
      context.restore();
    });
  }, [analysis.walls, hoverWall, ready, selectedWalls, visibleMarkers]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const image = new Image();
    image.src = displaySource;
    image.onload = async () => {
      if (cancelled) return;
      imageRef.current = image;
      if (analysis.walls.length) {
        const entries = await Promise.all(
          analysis.walls.map(async wall => [wall.id, await decodeMask(wall.mask, image.naturalWidth, image.naturalHeight)] as const),
        );
        if (cancelled) return;
        masks.current = Object.fromEntries(entries);
      } else {
        masks.current = {};
      }
      setReady(true);
    };
    image.onerror = () => { if (!cancelled) setReady(true); };
    return () => { cancelled = true; };
  }, [analysis.walls, displaySource]);

  useEffect(draw, [draw]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    return canvas ? clientToImagePoint(canvas, clientX, clientY) : null;
  };

  const wallAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const point = pointFromEvent(clientX, clientY);
    if (!canvas || !point) return null;
    const markerHit = analysis.walls.find(wall => {
      const marker = markerFor(wall, analysis.image, { width: canvas.width, height: canvas.height });
      return Math.hypot(point.x - marker.x, point.y - marker.y) <= 26;
    });
    if (markerHit) return markerHit.id;
    const offset = (point.y * canvas.width + point.x) * 4;
    return analysis.walls.find(wall => masks.current[wall.id]?.data[offset] > 10)?.id ?? null;
  };

  const toggleArea = (wallId: string) => {
    setSelectedWalls(current => current.includes(wallId) ? current.filter(id => id !== wallId) : [...current, wallId]);
    setSelectionError("");
  };

  const selectAllAreas = () => {
    setSelectedWalls(analysis.walls.map(wall => wall.id));
    setSelectionError("");
  };

  const clearSelection = () => {
    setSelectedWalls([]);
    setSelectionError("Select at least one wall.");
  };

  const updateColor = (color: string | PickedColor) => {
    if (typeof color === "string") {
      setSelectedColor({ hex: color.toUpperCase(), name: `Custom color ${color.toUpperCase()}` });
    } else {
      setSelectedColor({
        hex: color.hex.toUpperCase(),
        name: color.name,
        brand: color.shade?.brandName,
        shadeName: color.shade?.name,
        code: color.shade?.code,
      });
    }
    setSelectionError("");
    setVisualizeError("");
  };

  const generateVisualization = async (options: GenerateOptions = {}) => {
    if (!selectedColor) {
      setVisualizeError("Choose a paint color before applying.");
      return;
    }
    if (areaCount > 0 && !selectedWalls.length) {
      setSelectionError("Select at least one wall.");
      return;
    }

    setVisualizing(true);
    setVisualizingText(options.loadingText ?? "Applying color…");
    setVisualizeError("");
    setSelectionError("");
    try {
      const selectedAreaIds = areaCount > 0 ? selectedWalls : undefined;
      const targetPoints = selectedAreaIds?.map(id => {
        const wall = analysis.walls.find(item => item.id === id)!;
        const image = imageRef.current;
        return {
          id,
          ...markerFor(wall, analysis.image, {
            width: image?.naturalWidth ?? analysis.image.width,
            height: image?.naturalHeight ?? analysis.image.height,
          }),
        };
      });
      const image = await visualizeWallColor(originalFile, {
        hex: selectedColor.hex,
        name: selectedColor.name,
        aiOnly: areaCount === 0 || allAreasSelected,
        areaIds: selectedAreaIds,
        targetPoints,
        lightingValue: options.lightingValue,
        lightingLabel: options.lightingLabel,
      });
      if (editedSource) URL.revokeObjectURL(editedSource);
      latestResultBlob.current = image;
      setEditedSource(URL.createObjectURL(image));
      setDisplayMode("ai-result");
      const appliedLightingValue = typeof options.lightingValue === "number" ? options.lightingValue : 50;
      setLightingValue(appliedLightingValue);
      setFinalizedLightingValue(appliedLightingValue);
    } catch (error) {
      setVisualizeError(error instanceof Error ? error.message : "We couldn’t create your visualization.");
    } finally {
      setVisualizing(false);
    }
  };

  const applyLightingWithAi = () => generateVisualization({
    lightingValue,
    lightingLabel,
    loadingText: "Applying lighting…",
  });

  const downloadResult = () => {
    const blob = latestResultBlob.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wallwise-result.${extensionFor(blob.type)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }
    try {
      await workspaceRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(true);
    }
  };

  const selectionLabel = areaCount === 0
    ? "AI will identify all paintable walls"
    : allAreasSelected
      ? "All walls selected"
      : `${selectedWalls.length} of ${areaCount} walls selected`;

  return <main className="min-h-screen bg-[#f5f6f2] px-3 py-3 text-[#18211d] sm:px-5 md:px-7">
    <header className="mx-auto flex h-14 max-w-[1680px] items-center justify-between">
      <button onClick={onStartOver} className="rounded-lg px-2 py-2 text-sm font-semibold text-[#496252] transition hover:bg-white">← New image</button>
      <div className="text-center"><p className="m-0 text-[15px] font-bold uppercase tracking-[.2em]">Wallwise</p><p className="mt-0.5 text-[9px] font-semibold tracking-[.16em] text-[#718076]">PAINT VISUALIZER</p></div>
      <div className="w-[92px]" />
    </header>

    <section ref={workspaceRef} className={`mx-auto flex max-w-[1680px] flex-col ${isFullscreen ? "fixed inset-0 z-50 max-w-none bg-[#151a17] p-3 sm:p-6" : ""}`}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#dce2db] bg-[#e8ebe6] p-2 shadow-[0_12px_36px_rgba(24,33,29,.08)]">
        <div className="relative flex w-full items-center justify-center">
          {visibleMarkers && areaCount > 0 && <div className="absolute left-3 top-3 z-20 rounded-xl border border-[#d9e0d8] bg-white/95 px-3 py-2 text-xs font-bold text-[#243129] shadow-sm backdrop-blur">{selectionLabel}</div>}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-[#d9e0d8] bg-white/95 p-1 shadow-sm backdrop-blur">
            <button aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"} title={isFullscreen ? "Exit fullscreen" : "View fullscreen"} onClick={toggleFullscreen} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-[#243129] hover:bg-[#edf2ed]">{isFullscreen ? "×" : "⛶"}</button>
            <button disabled={!editedSource} aria-label={displayMode === "ai-result" ? "Show original image" : "Show edited image"} title={displayMode === "ai-result" ? "Show original" : "Show edited result"} onClick={() => setDisplayMode(mode => mode === "ai-result" ? "original" : "ai-result")} className="grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-bold text-[#243129] hover:bg-[#edf2ed] disabled:cursor-not-allowed disabled:opacity-35">{displayMode === "ai-result" ? "Original" : "After"}</button>
            <button disabled={!editedSource} aria-label="Download edited image" title="Download edited image" onClick={downloadResult} className="grid h-8 w-8 place-items-center rounded-lg text-base font-bold text-[#243129] hover:bg-[#edf2ed] disabled:cursor-not-allowed disabled:opacity-35">↓</button>
          </div>
          <div className="relative inline-block max-w-full">
            <canvas ref={canvasRef} onPointerDown={event => {
              if (displayMode !== "original") return;
              const wall = wallAt(event.clientX, event.clientY);
              if (wall) toggleArea(wall);
            }} onPointerMove={event => {
              if (displayMode !== "original") return;
              setHoverWall(wallAt(event.clientX, event.clientY));
            }} onPointerLeave={() => setHoverWall(null)} className={`block h-auto max-w-full touch-manipulation object-contain transition-[filter] duration-200 ${isFullscreen ? "max-h-[calc(100dvh-104px)]" : "max-h-[calc(100dvh-260px)] md:max-h-[calc(100dvh-220px)]"}`} style={{ cursor: displayMode === "original" && hoverWall ? "pointer" : "default", filter: canvasFilter }} />
          </div>
        </div>
        {!ready && <div className="absolute inset-0 grid place-items-center bg-[#e8ebe6]/80 text-sm font-medium text-slate-600">Preparing editor…</div>}
      </div>

      {!isFullscreen && <div className="mt-3 rounded-2xl border border-[#dbe3da] bg-white/95 p-3 shadow-[0_8px_28px_rgba(24,33,29,.06)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#718076]">Walls</span>
            <button onClick={selectAllAreas} disabled={!areaCount || allAreasSelected} className="h-8 rounded-lg border border-[#dbe3da] bg-[#fafcf9] px-2.5 text-xs font-bold text-[#526257] transition hover:border-[#9bad9f] disabled:cursor-not-allowed disabled:opacity-45">Select all walls</button>
            <button onClick={clearSelection} disabled={!areaCount || selectedWalls.length === 0} className="h-8 rounded-lg border border-[#dbe3da] bg-[#fafcf9] px-2.5 text-xs font-bold text-[#526257] transition hover:border-[#9bad9f] disabled:cursor-not-allowed disabled:opacity-45">Clear selection</button>
            <span className="text-xs font-semibold text-[#526257]">{selectionLabel}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setDisplayMode("original")} className={`h-8 rounded-lg border px-2.5 text-xs font-bold transition ${displayMode === "original" ? "border-[#18211d] bg-[#18211d] text-white" : "border-[#dbe3da] bg-[#fafcf9] text-[#526257] hover:border-[#9bad9f]"}`}>Original</button>
              {selectedColor ? <div className="flex min-w-0 items-center gap-2">
                <span className="h-7 w-7 shrink-0 rounded-lg border border-black/10" style={{ background: selectedColor.hex }} />
                <span className="min-w-0 truncate text-sm font-bold text-[#243129]">
                  {selectedColor.shadeName ? `${selectedColor.shadeName} · ` : ""}<span className="font-mono">{selectedColor.hex}</span>
                </span>
              </div> : <span className="text-xs font-medium text-[#718076]">No color selected</span>}
              <button onClick={() => setColorPickerOpen(true)} className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dbe3da] bg-[#fafcf9] px-2.5 text-xs font-bold text-[#526257] hover:border-[#9bad9f]">⌾ Pick Color</button>
            </div>
            {selectedColor?.brand && <p className="m-0 text-xs font-semibold text-[#718076]">{selectedColor.brand} · {selectedColor.shadeName} · {selectedColor.code}</p>}
            <ColorPanel value={selectedColor?.hex ?? null} onChange={updateColor} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => generateVisualization()} disabled={visualizing || !selectedColor || (areaCount > 0 && selectedWalls.length === 0)} className="h-10 whitespace-nowrap rounded-xl bg-[#18211d] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2c4034] disabled:cursor-not-allowed disabled:opacity-45">{visualizing ? visualizingText : "Apply"}</button>
          </div>
        </div>
        {editedSource && <div className="mt-3 rounded-2xl border border-[#dbe3da] bg-[#fafcf9] p-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 gap-4">
              <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl border border-[#dbe3da] bg-white px-2 py-3">
                <span className="text-xs font-bold text-[#b77828]" title="Direct sunlight">☀ Sun</span>
                <input
                  aria-label="Lighting preview slider"
                  type="range"
                  min="0"
                  max="100"
                  value={lightingValue}
                  onChange={event => setLightingValue(Number(event.target.value))}
                  className="my-3 h-40 w-8 accent-[#345447]"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />
                <span className="text-xs font-bold text-[#29445f]" title="Night / Artificial light">☾ Night</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[.14em] text-[#718076]">Lighting preview</p>
                    <p className="m-0 mt-1 text-sm font-bold text-[#18211d]">☀ {lightingLabel}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#526257]">{lightingValue}</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {LIGHTING_PRESETS.map(preset => {
                    const active = lightingValue === preset.value;
                    return <button key={preset.label} onClick={() => setLightingValue(preset.value)} className={`min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${active ? "border-[#18211d] bg-[#18211d] text-white" : "border-[#dbe3da] bg-white text-[#526257] hover:border-[#9bad9f]"}`}>
                      {preset.label}
                    </button>;
                  })}
                </div>
                <p className="m-0 mt-2 text-xs leading-5 text-[#718076]">Move the vertical Sun/Night slider for a quick preview. Use AI to create the final downloadable lighting result.</p>
              </div>
            </div>
            <button onClick={applyLightingWithAi} disabled={visualizing || !selectedColor || lightingValue === finalizedLightingValue || (areaCount > 0 && selectedWalls.length === 0)} className="h-10 shrink-0 rounded-xl border border-[#18211d] bg-white px-4 text-sm font-bold text-[#18211d] transition hover:bg-[#edf2ed] disabled:cursor-not-allowed disabled:opacity-45">{visualizing ? visualizingText : "Apply Lighting"}</button>
          </div>
        </div>}
        {(selectionError || visualizeError) && <p className="mb-0 mt-2 text-xs font-medium text-red-700">{selectionError || visualizeError}</p>}
        {areaCount > 0 && <p className="mb-0 mt-2 text-xs leading-5 text-[#718076]">By default all walls are included. Tap a wall marker or wall area on the original image to deselect it before applying.</p>}
      </div>}
    </section>
    {colorPickerOpen && <ColorPickerModal onClose={() => setColorPickerOpen(false)} onUseColor={color => { updateColor(color); setColorPickerOpen(false); }} />}
  </main>;
}
