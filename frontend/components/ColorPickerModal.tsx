"use client";

import { ChangeEvent, PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { isHex } from "@/lib/color";
import { PAINT_BRANDS, PaintBrandId, PaintShade, colorLabel, shadesForBrand } from "@/lib/paintCatalog";

type Point = { x: number; y: number };
export type PickedColor = { hex: string; name?: string; shade?: PaintShade };
type Props = { onClose: () => void; onUseColor: (color: PickedColor) => void };
type PickerMode = "catalog" | "custom" | "sample";
type MobileCatalogStep = "brands" | "categories" | "shades";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

export function ColorPickerModal({ onClose, onUseColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<PickerMode>("catalog");
  const [mobileStep, setMobileStep] = useState<MobileCatalogStep>("brands");
  const [brandId, setBrandId] = useState<PaintBrandId>("asian-paints");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedShade, setSelectedShade] = useState<PaintShade | null>(null);
  const [customHex, setCustomHex] = useState("#F5F3EC");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [samplePoint, setSamplePoint] = useState<Point | null>(null);
  const [sampledHex, setSampledHex] = useState<string | null>(null);

  const brandShades = useMemo(() => shadesForBrand(brandId), [brandId]);
  const selectedBrand = useMemo(() => PAINT_BRANDS.find(brand => brand.id === brandId), [brandId]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(brandShades.map(shade => shade.category)))], [brandShades]);
  const visibleShades = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return brandShades.filter(shade => {
      const matchesCategory = category === "All" || shade.category === category;
      const matchesQuery = !normalized || `${shade.name} ${shade.code} ${shade.category}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [brandShades, category, query]);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    sourceRef.current = null;
    setLoadError("");
    setSamplePoint(null);
    setSampledHex(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setImageUrl(URL.createObjectURL(file));
  };

  const sampleAt = (clientX: number, clientY: number) => {
    const rendered = imageRef.current, source = sourceRef.current;
    if (!rendered || !source) return;
    const rect = rendered.getBoundingClientRect();
    const x = clamp(Math.round((clientX - rect.left) / rect.width * source.naturalWidth), 0, source.naturalWidth - 1);
    const y = clamp(Math.round((clientY - rect.top) / rect.height * source.naturalHeight), 0, source.naturalHeight - 1);
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(source, 0, 0);
    const radius = 3, left = Math.max(0, x - radius), top = Math.max(0, y - radius);
    const data = context.getImageData(left, top, Math.min(radius * 2 + 1, source.naturalWidth - left), Math.min(radius * 2 + 1, source.naturalHeight - top)).data;
    let red = 0, green = 0, blue = 0, count = 0;
    for (let index = 0; index < data.length; index += 4) { red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++; }
    setSamplePoint({ x, y });
    setSampledHex(`#${hex(Math.round(red / count))}${hex(Math.round(green / count))}${hex(Math.round(blue / count))}`);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    setDragging(false);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const next = { x: event.clientX - dragStart.x, y: event.clientY - dragStart.y };
    if (Math.hypot(next.x - pan.x, next.y - pan.y) > 4) setDragging(true);
    setPan(next);
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) sampleAt(event.clientX, event.clientY);
    setDragStart(null);
  };
  const zoomWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom(value => clamp(value + (event.deltaY < 0 ? 0.15 : -0.15), 1, 4));
  };

  const useShade = (shade = selectedShade) => {
    if (!shade) return;
    onUseColor({ hex: shade.hex, name: colorLabel(shade), shade });
  };

  const chooseBrand = (nextBrandId: PaintBrandId) => {
    setBrandId(nextBrandId);
    setCategory("All");
    setQuery("");
    setSelectedShade(null);
    setMobileStep("categories");
  };

  const chooseCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    setSelectedShade(null);
    setMobileStep("shades");
  };

  return <div role="dialog" aria-modal="true" aria-label="Pick a paint color" className="fixed inset-0 z-[70] grid place-items-end bg-[#101612]/65 p-0 sm:place-items-center sm:p-6">
    <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl">
      <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[#e4eae3] p-4 sm:p-5">
        <div>
          <h2 className="m-0 text-lg font-semibold text-[#18211d]">Pick a paint shade</h2>
          <p className="mb-0 mt-1 text-sm text-slate-500">Choose a brand shade, enter a custom HEX, or sample a shade-card photo.</p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-600 hover:bg-slate-100" aria-label="Close color picker">×</button>
      </div>

      <div className="shrink-0 flex gap-2 overflow-x-auto border-b border-[#e4eae3] px-4 py-3 sm:px-5">
        {[
          ["catalog", "Brand catalog"],
          ["custom", "Custom HEX"],
          ["sample", "Sample shade card"],
        ].map(([key, label]) => <button key={key} onClick={() => setMode(key as PickerMode)} className={`h-9 shrink-0 rounded-xl px-3 text-sm font-bold transition ${mode === key ? "bg-[#18211d] text-white" : "bg-[#f1f4ef] text-[#526257] hover:bg-[#e5ebe3]"}`}>{label}</button>)}
      </div>

      {mode === "catalog" && <>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:hidden">
          <div className="shrink-0 border-b border-[#e4eae3] bg-white px-4 py-3">
            {mobileStep === "brands" && <>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[.14em] text-[#718076]">Step 1 of 3</p>
              <h3 className="m-0 mt-1 text-base font-bold text-[#18211d]">Choose company</h3>
            </>}
            {mobileStep === "categories" && <>
              <button onClick={() => setMobileStep("brands")} className="-ml-2 rounded-lg px-2 py-1 text-sm font-bold text-[#526257]">← Companies</button>
              <h3 className="m-0 mt-1 text-base font-bold text-[#18211d]">{selectedBrand?.name}</h3>
              <p className="m-0 mt-1 text-xs text-[#718076]">Choose a shade family</p>
            </>}
            {mobileStep === "shades" && <>
              <button onClick={() => setMobileStep("categories")} className="-ml-2 rounded-lg px-2 py-1 text-sm font-bold text-[#526257]">← Categories</button>
              <h3 className="m-0 mt-1 text-base font-bold text-[#18211d]">{category}</h3>
              <p className="m-0 mt-1 text-xs text-[#718076]">{selectedBrand?.name}</p>
            </>}
          </div>

          {mobileStep === "brands" && <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {PAINT_BRANDS.map(brand => <button key={brand.id} onClick={() => chooseBrand(brand.id)} className="rounded-2xl border border-[#dbe3da] bg-[#fafcf9] p-4 text-left shadow-sm transition active:scale-[.99]">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-[#18211d]">{brand.name}</span>
                  <span className="text-xl text-[#526257]">›</span>
                </span>
                <span className="mt-1 block text-sm leading-5 text-[#718076]">{brand.description}</span>
              </button>)}
            </div>
          </div>}

          {mobileStep === "categories" && <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              {categories.map(item => {
                const count = item === "All" ? brandShades.length : brandShades.filter(shade => shade.category === item).length;
                return <button key={item} onClick={() => chooseCategory(item)} className="min-h-24 rounded-2xl border border-[#dbe3da] bg-[#fafcf9] p-3 text-left shadow-sm transition active:scale-[.99]">
                  <span className="block text-sm font-bold text-[#18211d]">{item}</span>
                  <span className="mt-2 block text-xs font-semibold text-[#718076]">{count} shades</span>
                </button>;
              })}
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-[.12em] text-[#718076]">Search all shades</span>
              <input value={query} onChange={event => { setQuery(event.target.value); setCategory("All"); setMobileStep("shades"); }} placeholder="Shade name or code" className="mt-2 h-11 w-full rounded-xl border border-[#dbe3da] bg-white px-3 text-sm outline-none focus:border-[#9bad9f]" />
            </label>
          </div>}

          {mobileStep === "shades" && <div className="flex-1 overflow-y-auto p-4 pb-32">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search shade or code" className="mb-3 h-11 w-full rounded-xl border border-[#dbe3da] bg-[#fafcf9] px-3 text-sm outline-none focus:border-[#9bad9f]" />
            <div className="grid grid-cols-2 gap-3">
              {visibleShades.map(shade => {
                const active = selectedShade?.brandId === shade.brandId && selectedShade.code === shade.code;
                return <button key={`${shade.brandId}-${shade.code}`} onClick={() => setSelectedShade(shade)} className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition active:scale-[.99] ${active ? "border-[#18211d] ring-2 ring-[#18211d]/15" : "border-[#dbe3da]"}`}>
                  <span className="block h-20 border-b border-black/5" style={{ background: shade.hex }} />
                  <span className="block p-2.5">
                    <span className="block text-sm font-bold text-[#18211d]">{shade.name}</span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-[#526257]">{shade.code}</span>
                    <span className="mt-2 block font-mono text-xs font-bold text-[#18211d]">{shade.hex}</span>
                  </span>
                </button>;
              })}
            </div>
            <p className="mb-0 mt-4 text-xs leading-5 text-[#718076]">On-screen colors are approximate. Confirm final choices with a physical company swatch.</p>
          </div>}

          {selectedShade && <div className="shrink-0 border-t border-[#dbe3da] bg-white p-3 shadow-[0_-10px_28px_rgba(24,33,29,.10)]">
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <span className="h-11 w-11 shrink-0 rounded-lg border border-black/10" style={{ background: selectedShade.hex }} />
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-[#18211d]">{selectedShade.name}</p>
                <p className="m-0 mt-1 truncate text-xs font-semibold text-[#718076]">{selectedShade.brandName} · {selectedShade.code} · <span className="font-mono">{selectedShade.hex}</span></p>
              </div>
            </div>
            <button onClick={() => useShade()} className="h-11 w-full rounded-xl bg-[#18211d] text-sm font-bold text-white">Use this shade</button>
          </div>}
        </div>

        <div className="hidden min-h-0 flex-1 overflow-y-auto sm:grid lg:grid-cols-[260px_1fr] lg:overflow-hidden">
          <aside className="shrink-0 border-b border-[#e4eae3] p-3 lg:border-b-0 lg:border-r lg:p-5">
            <p className="m-0 text-[10px] font-bold uppercase tracking-[.14em] text-[#718076]">Select company</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
              {PAINT_BRANDS.map(brand => {
                const active = brand.id === brandId;
                return <button key={brand.id} onClick={() => { setBrandId(brand.id); setCategory("All"); setQuery(""); setSelectedShade(null); }} className={`w-[170px] shrink-0 rounded-xl border p-3 text-left transition lg:w-auto ${active ? "border-[#18211d] bg-[#18211d] text-white" : "border-[#dbe3da] bg-[#fafcf9] text-[#243129] hover:border-[#9bad9f]"}`}>
                  <span className="block text-sm font-bold">{brand.name}</span>
                  <span className={`mt-1 hidden text-xs leading-4 sm:block ${active ? "text-white/75" : "text-[#718076]"}`}>{brand.description}</span>
                </button>;
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col p-3 pb-4 sm:p-5 lg:overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.14em] text-[#718076]">Shade cards</p>
                <h3 className="m-0 mt-1 text-base font-bold text-[#18211d]">{selectedBrand?.name}</h3>
              </div>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search shade or code" className="h-10 rounded-xl border border-[#dbe3da] bg-[#fafcf9] px-3 text-sm outline-none focus:border-[#9bad9f]" />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold ${category === item ? "bg-[#345447] text-white" : "bg-[#edf2ed] text-[#526257] hover:bg-[#e1e9e0]"}`}>{item}</button>)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 pr-1 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto xl:grid-cols-4">
              {visibleShades.map(shade => {
                const active = selectedShade?.brandId === shade.brandId && selectedShade.code === shade.code;
                return <button key={`${shade.brandId}-${shade.code}`} onClick={() => setSelectedShade(shade)} onDoubleClick={() => useShade(shade)} className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-[#18211d] ring-2 ring-[#18211d]/15" : "border-[#dbe3da]"}`}>
                  <span className="block h-16 border-b border-black/5 sm:h-20" style={{ background: shade.hex }} />
                  <span className="block p-2.5 sm:p-3">
                    <span className="block text-sm font-bold text-[#18211d]">{shade.name}</span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-[#526257]">{shade.code}</span>
                    <span className="mt-1 block text-xs text-[#718076]">{shade.category}</span>
                    <span className="mt-2 block font-mono text-xs font-bold text-[#18211d]">{shade.hex}</span>
                  </span>
                </button>;
              })}
            </div>
            <p className="mb-0 mt-3 text-xs leading-5 text-[#718076]">These are curated on-screen shade options for development. Confirm final paint choices with a physical company swatch before purchasing.</p>
            {selectedShade && <SelectedColorBar hex={selectedShade.hex} title={selectedShade.name} subtitle={`${selectedShade.brandName} · ${selectedShade.code}`} onCancel={onClose} onUse={() => useShade()} />}
          </section>
        </div>
      </>}

      {mode === "custom" && <div className="p-4 sm:p-5">
        <div className="rounded-2xl border border-[#dbe3da] bg-[#fafcf9] p-4">
          <h3 className="m-0 text-base font-bold text-[#18211d]">Use a custom HEX color</h3>
          <p className="mb-0 mt-1 text-sm text-[#718076]">Use this when you already know the exact color code.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input aria-label="Custom paint color" type="color" value={isHex(customHex) ? customHex : "#F5F3EC"} onChange={event => setCustomHex(event.target.value.toUpperCase())} className="h-12 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
            <input aria-label="Custom HEX value" value={customHex} onChange={event => setCustomHex(event.target.value.toUpperCase())} className="h-11 w-32 rounded-xl border border-[#dbe3da] bg-white px-3 font-mono text-sm font-bold uppercase outline-none focus:border-[#9bad9f]" />
            <button disabled={!isHex(customHex)} onClick={() => onUseColor({ hex: customHex.toUpperCase(), name: `Custom color ${customHex.toUpperCase()}` })} className="h-11 rounded-xl bg-[#18211d] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">Use custom color</button>
          </div>
        </div>
      </div>}

      {mode === "sample" && <div className="p-4 sm:p-5">
        {!imageUrl ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[#cbd6ca] bg-[#f7faf7] p-6 text-center">
          <div>
            <p className="m-0 text-sm text-slate-600">Use evenly lit, neutral lighting for the closest on-screen match.</p>
            <button onClick={() => inputRef.current?.click()} className="mt-4 h-10 rounded-xl bg-[#18211d] px-4 text-sm font-semibold text-white">⌾ Take / Choose Photo</button>
          </div>
        </div> : <>
          <div className="flex items-center justify-between">
            <button onClick={() => inputRef.current?.click()} className="text-xs font-bold text-[#526257] hover:text-[#18211d]">Choose another photo</button>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(value => clamp(value - .25, 1, 4))} className="h-7 w-7 rounded-md border border-[#dbe3da] text-sm" aria-label="Zoom out">−</button>
              <span className="w-10 text-center text-xs font-semibold text-slate-500">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(value => clamp(value + .25, 1, 4))} className="h-7 w-7 rounded-md border border-[#dbe3da] text-sm" aria-label="Zoom in">+</button>
            </div>
          </div>
          <div onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onWheel={zoomWithWheel} className="relative mt-3 h-[min(55dvh,440px)] overflow-hidden rounded-xl bg-[#edf0eb] touch-none" style={{ cursor: dragging ? "grabbing" : "crosshair" }}>
            <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: "center" }}>
              <div className="relative">
                <img ref={imageRef} src={imageUrl} alt="Paint shade card" onLoad={event => { sourceRef.current = event.currentTarget; }} onError={() => setLoadError("This image could not be decoded in this browser. Please choose another shade-card image.")} className="block max-h-[min(55dvh,440px)] max-w-[calc(100vw-56px)] select-none object-contain" draggable={false} />
                {samplePoint && sourceRef.current && <span className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: `${samplePoint.x / sourceRef.current.naturalWidth * 100}%`, top: `${samplePoint.y / sourceRef.current.naturalHeight * 100}%`, transform: "translate(-50%,-50%)" }} />}
              </div>
            </div>
          </div>
        </>}
        <input ref={inputRef} className="hidden" type="file" accept="image/*,.heic,.heif" onChange={chooseImage} />
        {loadError && <p className="mb-0 mt-3 text-sm text-red-700">{loadError}</p>}
        {sampledHex && <SelectedColorBar hex={sampledHex} title="Sampled shade-card color" subtitle={sampledHex} onCancel={onClose} onUse={() => onUseColor({ hex: sampledHex, name: `Sampled color ${sampledHex}` })} />}
      </div>}
    </div>
  </div>;
}

function SelectedColorBar({ hex, title, subtitle, onCancel, onUse }: { hex: string; title: string; subtitle: string; onCancel: () => void; onUse: () => void }) {
  return <div className="sticky bottom-0 mt-4 flex flex-col gap-3 rounded-xl border border-[#dbe3da] bg-[#fafcf9]/95 p-3 shadow-[0_-10px_28px_rgba(24,33,29,.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <span className="h-11 w-11 shrink-0 rounded-lg border border-black/10" style={{ background: hex }} />
      <div className="min-w-0">
        <p className="m-0 truncate text-sm font-bold text-[#18211d]">{title}</p>
        <p className="m-0 mt-1 truncate text-xs font-semibold text-[#718076]">{subtitle} · <span className="font-mono">{hex}</span></p>
      </div>
    </div>
    <div className="flex gap-2">
      <button onClick={onCancel} className="h-9 rounded-lg px-3 text-sm font-semibold text-[#526257] hover:bg-[#edf2ed]">Cancel</button>
      <button onClick={onUse} className="h-10 flex-1 rounded-lg bg-[#18211d] px-3 text-sm font-semibold text-white sm:h-9 sm:flex-none">Use this shade</button>
    </div>
  </div>;
}
