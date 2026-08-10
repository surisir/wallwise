"use client";

import { ChangeEvent, PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Props = { onClose: () => void; onUseColor: (hex: string) => void };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

export function ColorPickerModal({ onClose, onUseColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [samplePoint, setSamplePoint] = useState<Point | null>(null);
  const [sampledHex, setSampledHex] = useState<string | null>(null);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    sourceRef.current = null; setLoadError(""); setSamplePoint(null); setSampledHex(null); setPan({ x: 0, y: 0 }); setZoom(1);
    setImageUrl(URL.createObjectURL(file));
  };
  const sampleAt = (clientX: number, clientY: number) => {
    const rendered = imageRef.current, source = sourceRef.current;
    if (!rendered || !source) return;
    const rect = rendered.getBoundingClientRect();
    const x = clamp(Math.round((clientX - rect.left) / rect.width * source.naturalWidth), 0, source.naturalWidth - 1);
    const y = clamp(Math.round((clientY - rect.top) / rect.height * source.naturalHeight), 0, source.naturalHeight - 1);
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(source, 0, 0);
    const radius = 3, left = Math.max(0, x - radius), top = Math.max(0, y - radius);
    const data = context.getImageData(left, top, Math.min(radius * 2 + 1, source.naturalWidth - left), Math.min(radius * 2 + 1, source.naturalHeight - top)).data;
    let red = 0, green = 0, blue = 0, count = 0;
    for (let index = 0; index < data.length; index += 4) { red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++; }
    setSamplePoint({ x, y }); setSampledHex(`#${hex(Math.round(red / count))}${hex(Math.round(green / count))}${hex(Math.round(blue / count))}`);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y }); setDragging(false); };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => { if (!dragStart) return; const next = { x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }; if (Math.hypot(next.x - pan.x, next.y - pan.y) > 4) setDragging(true); setPan(next); };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => { if (!dragging) sampleAt(event.clientX, event.clientY); setDragStart(null); };
  const zoomWithWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); setZoom(value => clamp(value + (event.deltaY < 0 ? 0.15 : -0.15), 1, 4)); };

  return <div role="dialog" aria-modal="true" aria-label="Pick a color from a shade card" className="fixed inset-0 z-[70] grid place-items-center bg-[#101612]/65 p-3 sm:p-6">
    <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="m-0 text-lg font-semibold text-[#18211d]">Pick a color</h2><p className="mb-0 mt-1 text-sm text-slate-500">Take a photo or choose an image of your paint shade card.</p></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-600 hover:bg-slate-100" aria-label="Close color picker">×</button></div>
      {!imageUrl ? <div className="mt-5 grid min-h-56 place-items-center rounded-xl border border-dashed border-[#cbd6ca] bg-[#f7faf7] p-6 text-center"><div><p className="m-0 text-sm text-slate-600">Use evenly lit, neutral lighting for the closest on-screen match.</p><button onClick={() => inputRef.current?.click()} className="mt-4 h-10 rounded-xl bg-[#18211d] px-4 text-sm font-semibold text-white">⌾ Take / Choose Photo</button></div></div> : <><div className="mt-4 flex items-center justify-between"><button onClick={() => inputRef.current?.click()} className="text-xs font-bold text-[#526257] hover:text-[#18211d]">Choose another photo</button><div className="flex items-center gap-1"><button onClick={() => setZoom(value => clamp(value - .25, 1, 4))} className="h-7 w-7 rounded-md border border-[#dbe3da] text-sm" aria-label="Zoom out">−</button><span className="w-10 text-center text-xs font-semibold text-slate-500">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => clamp(value + .25, 1, 4))} className="h-7 w-7 rounded-md border border-[#dbe3da] text-sm" aria-label="Zoom in">+</button></div></div>
        <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onWheel={zoomWithWheel} className="relative mt-3 h-[min(55dvh,440px)] overflow-hidden rounded-xl bg-[#edf0eb] touch-none" style={{ cursor: dragging ? "grabbing" : "crosshair" }}><div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: "center" }}><div className="relative"><img ref={imageRef} src={imageUrl} alt="Paint shade card" onLoad={event => { sourceRef.current = event.currentTarget; }} onError={() => setLoadError("This image could not be decoded in this browser. Please choose another shade-card image.")} className="block max-h-[min(55dvh,440px)] max-w-[calc(100vw-56px)] select-none object-contain" draggable={false} />{samplePoint && sourceRef.current && <span className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: `${samplePoint.x / sourceRef.current.naturalWidth * 100}%`, top: `${samplePoint.y / sourceRef.current.naturalHeight * 100}%`, transform: "translate(-50%,-50%)" }} />}</div></div></div>
      </>}
      <input ref={inputRef} className="hidden" type="file" accept="image/*,.heic,.heif" onChange={chooseImage} />
      {loadError && <p className="mb-0 mt-3 text-sm text-red-700">{loadError}</p>}
      {sampledHex && <div className="mt-4 flex items-center justify-between rounded-xl border border-[#dbe3da] bg-[#fafcf9] p-3"><div className="flex items-center gap-3"><span className="h-10 w-10 rounded-lg border border-black/10" style={{ background: sampledHex }} /><div><p className="m-0 text-xs font-bold uppercase tracking-wide text-[#718076]">Selected color</p><p className="m-0 mt-1 font-mono text-base font-bold">{sampledHex}</p></div></div><div className="flex gap-2"><button onClick={onClose} className="h-9 rounded-lg px-3 text-sm font-semibold text-[#526257] hover:bg-[#edf2ed]">Cancel</button><button onClick={() => onUseColor(sampledHex)} className="h-9 rounded-lg bg-[#18211d] px-3 text-sm font-semibold text-white">Use this color</button></div></div>}
    </div>
  </div>;
}
