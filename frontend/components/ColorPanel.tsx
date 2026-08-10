"use client";
import { SWATCHES, isHex } from "@/lib/color";
import { useEffect, useState } from "react";

export function ColorPanel({ value, onChange }: { value: string | null; onChange: (hex: string) => void }) {
  const [input, setInput] = useState(value ?? ""); useEffect(() => setInput(value ?? ""), [value]);
  const apply = (next: string) => { setInput(next); if (isHex(next)) onChange(next.toUpperCase()); };
  const current = value && isHex(value) ? value.toUpperCase() : "#E9E0CE";
  return <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#dbe3da] bg-[#fafcf9] p-1.5">
      <input aria-label="Custom color picker" className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" type="color" value={current} onChange={(event) => apply(event.target.value)} />
      <input aria-label="Hex color" value={input} onChange={(event) => apply(event.target.value)} className="w-[88px] bg-transparent px-1 font-mono text-sm font-semibold uppercase tracking-tight outline-none" />
    </div>
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {SWATCHES.map((swatch) => {
        const active = Boolean(value) && current === swatch.hex;
        return <button title={swatch.name} aria-label={swatch.name} key={swatch.hex} onClick={() => apply(swatch.hex)} className={`relative h-9 w-9 shrink-0 rounded-lg border-2 p-0.5 transition ${active ? "border-[#18211d] shadow-sm" : "border-transparent hover:border-[#9bad9f]"}`}>
          <span className="block h-full w-full rounded-[5px]" style={{ background: swatch.hex }} />
          {active && <span className="absolute inset-0 grid place-items-center text-xs font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.7)]">✓</span>}
        </button>;
      })}
    </div>
  </div>;
}
