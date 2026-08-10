"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisResult } from "@/types/analysis";
import { clientToImagePoint } from "@/lib/canvas";
import { visualizeWallColor } from "@/lib/api";
import { ColorPanel } from "./ColorPanel";
import { ColorPickerModal } from "./ColorPickerModal";

type Props = { originalSource: string; originalFile: File; analysis: AnalysisResult; onStartOver: () => void };
type ColorMap = Record<string, string>;
type Point = { x: number; y: number };
type DisplayMode = "original" | "local-preview" | "ai-result";

async function decodeMask(mask: string, width: number, height: number): Promise<ImageData> {
  const image = new Image();
  image.src = `data:image/png;base64,${mask}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

const copyMask = (mask: ImageData) => new ImageData(new Uint8ClampedArray(mask.data), mask.width, mask.height);

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return match ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)] : null;
}

export function ImageEditor({ originalSource, originalFile, analysis, onStartOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const masks = useRef<Record<string, ImageData>>({});
  const originalMasks = useRef<Record<string, ImageData>>({});
  const maskHistory = useRef<{ wallId: string; mask: ImageData }[]>([]);
  const stroke = useRef<{ start: Point; last: Point } | null>(null);
  const painting = useRef(false);

  const [ready, setReady] = useState(false);
  const [colors, setColors] = useState<ColorMap>({});
  const [localPreviewColors, setLocalPreviewColors] = useState<ColorMap>({});
  const [colorHistory, setColorHistory] = useState<ColorMap[]>([]);
  const [selectedWalls, setSelectedWalls] = useState<string[]>(analysis.walls[0]?.id ? [analysis.walls[0].id] : []);
  const [hoverWall, setHoverWall] = useState<string | null>(null);
  const [editedSource, setEditedSource] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("original");
  const [visualizing, setVisualizing] = useState(false);
  const [visualizeError, setVisualizeError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [tool, setTool] = useState<"select" | "add" | "erase">("select");
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [maskVersion, setMaskVersion] = useState(0);
  const [maskUndoCount, setMaskUndoCount] = useState(0);
  const [magnifier, setMagnifier] = useState<{ x: number; y: number; left: number; top: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const displaySource = displayMode === "ai-result" && editedSource ? editedSource : originalSource;
  const showingTrueOriginal = displayMode === "original";
  const selectedWall = selectedWalls.at(-1) ?? null;
  const draw = useCallback(() => {
    const canvas = canvasRef.current, original = imageRef.current;
    if (!canvas || !original || !ready) return;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.canvas.width = original.naturalWidth; context.canvas.height = original.naturalHeight;
    context.drawImage(original, 0, 0);
    if (displayMode === "ai-result" && editedSource) return;
    const rendered = context.getImageData(0, 0, canvas.width, canvas.height);

    // Instant preview is intentionally client-only: apply each saved wall
    // color through its detected/refined mask while retaining the source
    // pixels' texture and lighting. This is separate from AI visualization.
    Object.entries(localPreviewColors).forEach(([wallId, hex]) => {
      const mask = masks.current[wallId], paint = hexToRgb(hex);
      if (!mask || !paint) return;
      for (let i = 0; i < rendered.data.length; i += 4) {
        // Decoded masks are grayscale PNGs: their coverage is in the RGB
        // channel while their PNG alpha is opaque for every pixel.
        const maskAlpha = mask.data[i] / 255;
        if (maskAlpha <= 0) continue;
        const paintAlpha = 0.62 * maskAlpha;
        rendered.data[i] = rendered.data[i] * (1 - paintAlpha) + paint[0] * paintAlpha;
        rendered.data[i + 1] = rendered.data[i + 1] * (1 - paintAlpha) + paint[1] * paintAlpha;
        rendered.data[i + 2] = rendered.data[i + 2] * (1 - paintAlpha) + paint[2] * paintAlpha;
      }
    });
    const highlightedWalls = hoverWall ? [hoverWall] : (displayMode === "local-preview" || tool !== "select" ? selectedWalls : []);
    Array.from(new Set(highlightedWalls)).forEach(id => {
      const mask = masks.current[id!];
      if (!mask) return;
      const alpha = (id === hoverWall ? 36 : 82) / 255;
      for (let i = 0; i < rendered.data.length; i += 4) if (mask.data[i] > 10) {
        rendered.data[i] = rendered.data[i] * (1 - alpha) + 76 * alpha;
        rendered.data[i + 1] = rendered.data[i + 1] * (1 - alpha) + 113 * alpha;
        rendered.data[i + 2] = rendered.data[i + 2] * (1 - alpha) + 94 * alpha;
      }
    });
    context.putImageData(rendered, 0, 0);
  }, [displayMode, editedSource, hoverWall, localPreviewColors, maskVersion, ready, selectedWalls, tool]);

  useEffect(() => {
    let cancelled = false;
    // A generated blob URL is a new after-image. Force the canvas through a
    // complete load cycle so it cannot keep displaying the previously loaded
    // image until an unrelated wall-selection state change occurs.
    setReady(false);
    const original = new Image();
    original.src = displaySource;
    original.onload = async () => {
      if (cancelled) return;
      imageRef.current = original;
      const entries = analysis.walls.length ? await Promise.all(analysis.walls.map(async wall => [wall.id, await decodeMask(wall.mask, original.naturalWidth, original.naturalHeight)] as const)) : [["manual-wall", new ImageData(original.naturalWidth, original.naturalHeight)] as const];
      if (cancelled) return;
      masks.current = Object.fromEntries(entries);
      originalMasks.current = Object.fromEntries(entries.map(([id, mask]) => [id, copyMask(mask)]));
      if (!analysis.walls.length) setSelectedWalls(["manual-wall"]);
      setReady(true);
    };
    original.onerror = () => { if (!cancelled) setReady(true); };
    return () => { cancelled = true; };
  }, [analysis.walls, displaySource]);
  useEffect(draw, [draw]);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => {
    const sourceCanvas = canvasRef.current, lens = lensRef.current;
    if (!sourceCanvas || !lens || !magnifier || tool === "select") return;
    const context = lens.getContext("2d")!, crop = 80;
    lens.width = 180; lens.height = 180; context.imageSmoothingEnabled = false;
    context.drawImage(sourceCanvas, Math.max(0, Math.min(sourceCanvas.width - crop, magnifier.x - crop / 2)), Math.max(0, Math.min(sourceCanvas.height - crop, magnifier.y - crop / 2)), crop, crop, 0, 0, 180, 180);
    context.strokeStyle = "rgba(24,33,29,.85)"; context.lineWidth = 2;
    context.beginPath(); context.moveTo(90, 0); context.lineTo(90, 180); context.moveTo(0, 90); context.lineTo(180, 90); context.stroke();
  }, [draw, magnifier, tool]);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    return canvas ? clientToImagePoint(canvas, clientX, clientY) : null;
  };
  const wallAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current, point = pointFromEvent(clientX, clientY);
    if (!canvas || !point) return null;
    const offset = (point.y * canvas.width + point.x) * 4;
    return analysis.walls.find(wall => masks.current[wall.id]?.data[offset] > 10)?.id ?? null;
  };
  const updateMagnifier = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current, point = pointFromEvent(clientX, clientY);
    if (!canvas || !point || tool === "select") return;
    const rect = canvas.getBoundingClientRect();
    setMagnifier({ ...point, left: clientX - rect.left, top: clientY - rect.top });
  };
  const paintAt = (point: Point) => {
    if (!selectedWall || tool === "select") return;
    const mask = masks.current[selectedWall], value = tool === "add" ? 255 : 0;
    if (!mask) return;
    for (let y = Math.max(0, point.y - brushSize); y <= Math.min(mask.height - 1, point.y + brushSize); y++) {
      for (let x = Math.max(0, point.x - brushSize); x <= Math.min(mask.width - 1, point.x + brushSize); x++) {
        if ((x - point.x) ** 2 + (y - point.y) ** 2 > brushSize ** 2) continue;
        const offset = (y * mask.width + x) * 4;
        mask.data[offset] = value; mask.data[offset + 1] = value; mask.data[offset + 2] = value; mask.data[offset + 3] = 255;
      }
    }
  };
  const paintStroke = (clientX: number, clientY: number, shiftKey: boolean) => {
    const raw = pointFromEvent(clientX, clientY);
    if (!raw) return;
    const start = stroke.current?.start;
    const point = shiftKey && start ? (Math.abs(raw.x - start.x) >= Math.abs(raw.y - start.y) ? { x: raw.x, y: start.y } : { x: start.x, y: raw.y }) : raw;
    const previous = stroke.current?.last ?? point;
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / Math.max(2, brushSize / 3)));
    for (let step = 0; step <= steps; step++) paintAt({ x: Math.round(previous.x + (point.x - previous.x) * step / steps), y: Math.round(previous.y + (point.y - previous.y) * step / steps) });
    if (stroke.current) stroke.current.last = point;
    setMaskVersion(version => version + 1);
  };
  const undo = () => {
    const maskChange = maskHistory.current.pop();
    if (maskChange) { masks.current[maskChange.wallId] = maskChange.mask; setMaskUndoCount(maskHistory.current.length); setMaskVersion(version => version + 1); return; }
    const colorsBefore = colorHistory.at(-1);
    if (colorsBefore) { setColors(colorsBefore); setLocalPreviewColors(colorsBefore); setDisplayMode("local-preview"); setColorHistory(history => history.slice(0, -1)); }
  };
  const updateColor = (hex: string) => {
    if (!selectedWalls.length) { setSelectionError("Select at least one area."); return; }
    setColorHistory(history => [...history.slice(-19), colors]);
    const nextColors = { ...colors };
    selectedWalls.forEach(wallId => { nextColors[wallId] = hex; });
    setColors(nextColors);
    setLocalPreviewColors(nextColors);
    setDisplayMode("local-preview");
    setSelectionError("");
  };
  const generateVisualization = async () => {
    if (!selectedWalls.length) { setSelectionError("Select at least one area."); return; }
    const hex = displayMode === "local-preview" && selectedWall ? colors[selectedWall] : undefined;
    if (!hex) { setVisualizeError("Choose a paint color before visualizing."); return; }
    setVisualizing(true); setVisualizeError("");
    try {
      const image = await visualizeWallColor(originalFile, { hex, aiOnly: analysis.walls.length === 0, areaIds: selectedWalls });
      // Each response gets a fresh object URL. Updating editedSource and
      // switching out of before mode makes the generated after-image active
      // immediately, while the effect above reloads the canvas deterministically.
      setEditedSource(URL.createObjectURL(image)); setDisplayMode("ai-result");
    } catch (error) {
      setVisualizeError(error instanceof Error ? error.message : "We couldn’t create your visualization.");
    } finally { setVisualizing(false); }
  };
  const resetSelected = () => {
    const selectedWithColors = selectedWalls.filter(wallId => colors[wallId]);
    if (!selectedWithColors.length) return;
    setColorHistory(history => [...history.slice(-19), colors]);
    const remaining = { ...colors };
    selectedWithColors.forEach(wallId => delete remaining[wallId]);
    setColors(remaining); setLocalPreviewColors(remaining); setDisplayMode(Object.keys(remaining).length ? "local-preview" : "original");
  };
  const resetAll = () => {
    if (!Object.keys(colors).length) return;
    setColorHistory(history => [...history.slice(-19), colors]); setColors({}); setLocalPreviewColors({}); setDisplayMode("original");
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
      // The CSS fallback still provides an unobstructed viewer if the browser
      // declines the Fullscreen API (for example, in an embedded webview).
      setIsFullscreen(true);
    }
  };
  const areaCount = analysis.walls.length;
  const selectedColor = displayMode === "local-preview" && selectedWall ? colors[selectedWall] : undefined;
  const hasMultipleAreas = areaCount > 1;
  const allAreasSelected = areaCount > 0 && selectedWalls.length === areaCount;
  const toggleArea = (wallId: string) => {
    setSelectedWalls(current => current.includes(wallId) ? current.filter(id => id !== wallId) : [...current, wallId]);
    setSelectionError("");
  };
  const toggleAllAreas = () => {
    setSelectedWalls(allAreasSelected ? [] : analysis.walls.map(wall => wall.id));
    setSelectionError("");
  };
  const canUndo = maskUndoCount > 0 || colorHistory.length > 0;

  return <main className="min-h-screen bg-[#f5f6f2] px-3 py-3 text-[#18211d] sm:px-5 md:px-7">
    <header className="mx-auto flex h-14 max-w-[1680px] items-center justify-between">
      <button onClick={onStartOver} className="rounded-lg px-2 py-2 text-sm font-semibold text-[#496252] transition hover:bg-white">← New image</button>
      <div className="text-center"><p className="m-0 text-[15px] font-bold uppercase tracking-[.2em]">Wallwise</p><p className="mt-0.5 text-[9px] font-semibold tracking-[.16em] text-[#718076]">PAINT VISUALIZER</p></div>
      <div className="w-[92px]" />
    </header>

    <section ref={workspaceRef} className={`mx-auto flex max-w-[1680px] flex-col ${isFullscreen ? "fixed inset-0 z-50 max-w-none bg-[#151a17] p-3 sm:p-6" : ""}`}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#dce2db] bg-[#e8ebe6] p-2 shadow-[0_12px_36px_rgba(24,33,29,.08)]">
        <div className="relative flex w-full items-center justify-center">
          <div className="absolute left-3 top-3 z-20 flex items-center rounded-xl border border-[#d9e0d8] bg-white/95 p-1 shadow-sm backdrop-blur">
            <button aria-label={toolbarOpen ? "Collapse refinement tools" : "Expand refinement tools"} title={toolbarOpen ? "Collapse refinement tools" : "Expand refinement tools"} onClick={() => setToolbarOpen(open => !open)} className="grid h-8 w-8 place-items-center rounded-lg bg-[#18211d] text-base font-bold text-white">{toolbarOpen ? "‹" : "✎"}</button>
            {toolbarOpen && <div className="ml-1 flex items-center gap-1"><span className="px-1 text-[10px] font-bold uppercase tracking-wide text-[#718076]">Refine</span>
              {(["select", "add", "erase"] as const).map(mode => <button key={mode} onClick={() => setTool(mode)} className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize ${tool === mode ? "bg-[#18211d] text-white" : "text-slate-700 hover:bg-slate-100"}`}>{mode}</button>)}
              <button aria-label="Undo last edit" title="Undo last edit" onClick={undo} disabled={!canUndo} className="rounded-lg px-2 py-1 text-lg font-semibold leading-none text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35">↶</button>
              {tool !== "select" && <label className="ml-1 flex items-center gap-1 pr-1 text-xs font-medium">Brush<input aria-label="Brush size" className="w-14 accent-[#58705f]" type="range" min="6" max="100" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} /></label>}
            </div>}
          </div>
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-[#d9e0d8] bg-white/95 p-1 shadow-sm backdrop-blur">
            <button aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"} title={isFullscreen ? "Exit fullscreen" : "View fullscreen"} onClick={toggleFullscreen} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-[#243129] hover:bg-[#edf2ed]">{isFullscreen ? "×" : "⛶"}</button>
            <button disabled={!editedSource} aria-label={displayMode === "ai-result" ? "Show original image" : "Show edited image"} title={displayMode === "ai-result" ? "Show original" : "Show edited result"} onClick={() => setDisplayMode(mode => mode === "ai-result" ? "original" : "ai-result")} className="grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-bold text-[#243129] hover:bg-[#edf2ed] disabled:cursor-not-allowed disabled:opacity-35">◐</button>
          </div>
          <div className="relative inline-block max-w-full">
          {showingTrueOriginal && <img src={originalSource} alt="Original uploaded room" className={`block h-auto max-w-full object-contain ${isFullscreen ? "max-h-[calc(100dvh-104px)]" : "max-h-[calc(100dvh-260px)] md:max-h-[calc(100dvh-220px)]"}`} />}
          <canvas ref={canvasRef} onPointerDown={event => {
            if (tool === "select") { const wall = wallAt(event.clientX, event.clientY); if (wall) toggleArea(wall); return; }
            const canvas = canvasRef.current, currentMask = selectedWall ? masks.current[selectedWall] : null, point = pointFromEvent(event.clientX, event.clientY);
            if (!canvas || !currentMask || !selectedWall || !point) return;
            maskHistory.current.push({ wallId: selectedWall, mask: copyMask(currentMask) }); if (maskHistory.current.length > 20) maskHistory.current.shift(); setMaskUndoCount(maskHistory.current.length);
            stroke.current = { start: point, last: point }; painting.current = true; event.currentTarget.setPointerCapture(event.pointerId); updateMagnifier(event.clientX, event.clientY); paintStroke(event.clientX, event.clientY, event.shiftKey);
          }} onPointerMove={event => {
            if (tool === "select") setHoverWall(wallAt(event.clientX, event.clientY));
            else { updateMagnifier(event.clientX, event.clientY); if (painting.current) paintStroke(event.clientX, event.clientY, event.shiftKey); }
          }} onPointerUp={() => { painting.current = false; stroke.current = null; }} onPointerLeave={() => { painting.current = false; stroke.current = null; setHoverWall(null); setMagnifier(null); }} className={showingTrueOriginal ? "absolute inset-0 h-full w-full touch-manipulation opacity-0" : `block h-auto max-w-full touch-manipulation object-contain ${isFullscreen ? "max-h-[calc(100dvh-104px)]" : "max-h-[calc(100dvh-260px)] md:max-h-[calc(100dvh-220px)]"}`} style={{ cursor: tool === "select" ? (hoverWall ? "pointer" : "default") : "crosshair" }} />
          </div>
          {magnifier && tool !== "select" && <div className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-[#18211d] bg-white shadow-xl" style={{ width: 144, height: 144, left: magnifier.left, top: magnifier.top, transform: "translate(14px, 14px)" }}><canvas ref={lensRef} className="h-full w-full" /></div>}
        </div>
        {!ready && <div className="absolute inset-0 grid place-items-center bg-[#e8ebe6]/80 text-sm font-medium text-slate-600">Preparing editor…</div>}
      </div>

      {!isFullscreen && <div className="mt-3 rounded-2xl border border-[#dbe3da] bg-white/95 p-3 shadow-[0_8px_28px_rgba(24,33,29,.06)] sm:p-4">
        {areaCount === 0 && <p className="mb-3 text-xs leading-5 text-[#77541d]">Detection is uncertain. Refine a paintable area on the image, then choose a color.</p>}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {hasMultipleAreas && <div className="flex shrink-0 items-center gap-2 overflow-x-auto"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#718076]">Choose area</span><button onClick={toggleAllAreas} className={`h-8 shrink-0 rounded-lg px-2.5 text-xs font-bold transition ${allAreasSelected ? "bg-[#e8eee8] text-[#243129]" : "border border-[#dbe3da] bg-[#fafcf9] text-[#526257] hover:border-[#9bad9f]"}`}>{allAreasSelected ? "Clear" : "Select all"}</button>{analysis.walls.map((wall, index) => { const active = selectedWalls.includes(wall.id); return <button key={wall.id} onClick={() => toggleArea(wall.id)} className={`h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition ${active ? "bg-[#18211d] text-white" : "border border-[#dbe3da] bg-[#fafcf9] text-[#526257] hover:border-[#9bad9f]"}`}>{active && "✓ "}Area {index + 1}</button>; })}</div>}
          <div className="flex min-w-0 flex-1 flex-col gap-2"><div className="flex items-center gap-2"><button onClick={() => setDisplayMode("original")} className={`h-8 rounded-lg border px-2.5 text-xs font-bold transition ${displayMode === "original" ? "border-[#18211d] bg-[#18211d] text-white" : "border-[#dbe3da] bg-[#fafcf9] text-[#526257] hover:border-[#9bad9f]"}`}>Original</button>{selectedColor ? <><span className="h-7 w-7 rounded-lg border border-black/10" style={{ background: selectedColor }} /><span className="font-mono text-sm font-bold text-[#243129]">{selectedColor}</span></> : <span className="text-xs font-medium text-[#718076]">No color selected</span>}<button onClick={() => setColorPickerOpen(true)} disabled={!selectedWalls.length} className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dbe3da] bg-[#fafcf9] px-2.5 text-xs font-bold text-[#526257] hover:border-[#9bad9f] disabled:opacity-35">⌾ Pick Color</button></div><ColorPanel value={selectedColor ?? null} onChange={updateColor} /></div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={generateVisualization} disabled={visualizing || !selectedColor} className="h-10 whitespace-nowrap rounded-xl bg-[#18211d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2c4034] disabled:cursor-not-allowed disabled:opacity-45">{visualizing ? "Applying paint color…" : "✦ Visualize with AI"}</button>
            <div className="flex items-center gap-1"><button onClick={resetSelected} disabled={!selectedWalls.some(wallId => colors[wallId])} className="rounded-lg px-2 py-2 text-xs font-semibold text-[#526257] hover:bg-[#edf2ed] disabled:opacity-35">Reset area</button><button onClick={resetAll} disabled={!Object.keys(colors).length} className="rounded-lg px-2 py-2 text-xs font-semibold text-[#526257] hover:bg-[#edf2ed] disabled:opacity-35">Reset all</button></div>
          </div>
        </div>
        {(selectionError || visualizeError) && <p className="mb-0 mt-2 text-xs font-medium text-red-700">{selectionError || visualizeError}</p>}
      </div>}
    </section>
    {colorPickerOpen && <ColorPickerModal onClose={() => setColorPickerOpen(false)} onUseColor={hex => { updateColor(hex); setColorPickerOpen(false); }} />}
  </main>;
}
