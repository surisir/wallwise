"use client";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

function hasSupportedExtension(filename: string) {
  const name = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function ImageUploader({ onUpload }: { onUpload: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null); const [error, setError] = useState("");
  const choose = (file?: File) => {
    if (!file) return;
    const hasExtension = hasSupportedExtension(file.name);
    const isHeifWithUnreliableMime = (file.type === "application/octet-stream" || !file.type)
      && /\.hei[cf]$/i.test(file.name);

    // Safari may send iPhone camera photos as HEIC with an empty or generic
    // MIME type. The backend decodes the original bytes, so do not require the
    // browser to identify or decode HEIC correctly before uploading it.
    if (!SUPPORTED_MIME_TYPES.has(file.type) && !hasExtension && !isHeifWithUnreliableMime) {
      setError("Choose a JPG, PNG, WEBP, HEIC, or HEIF image.");
      return;
    }
    if (file.size > MAX_BYTES) { setError("Image exceeds the 10 MB upload limit."); return; }
    setError("");
    onUpload(file);
  };
  return <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-12">
    <div className="mb-10 max-w-2xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-sage">Wallwise</p><h1 className="m-0 text-5xl font-semibold tracking-tight md:text-6xl">See your room in a new color.</h1><p className="mt-5 text-lg leading-8 text-slate-600">Upload a room photo. We find its walls, then let you visualize paint colors while retaining the room’s natural light and texture.</p></div>
    <div onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }} className="panel flex min-h-80 flex-col items-center justify-center border-2 border-dashed border-[#c7d0c7] px-6 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#e3ebe4] text-2xl">↑</div><h2 className="m-0 text-xl font-semibold">Drop a room image here</h2><p className="mb-6 mt-2 text-slate-500">or choose one from your computer</p>
      <button onClick={() => input.current?.click()} className="rounded-xl bg-ink px-5 py-3 font-semibold text-white hover:bg-[#2a3932]">Browse Image</button><input ref={input} className="hidden" type="file" accept="image/*,.heic,.heif" onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])} />
      <p className="mt-6 text-sm text-slate-500">JPG, PNG, WEBP, HEIC, or HEIF · Up to 10 MB · Images are not permanently stored</p>{error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </div>
  </section>;
}
