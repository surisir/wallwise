"use client";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { ProjectType } from "@/types/project";

const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

function hasSupportedExtension(filename: string) {
  const name = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function ImageUploader({ onUpload }: { onUpload: (file: File, projectType: ProjectType) => void }) {
  const browseInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("interior");
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
    onUpload(file, projectType);
  };
  return <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-12">
    <div className="mb-10 max-w-2xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-sage">Wallwise</p><h1 className="m-0 text-5xl font-semibold tracking-tight md:text-6xl">Preview paint colors before you paint.</h1><p className="mt-5 text-lg leading-8 text-slate-600">Upload an interior room or exterior home photo. WALLWISE helps you visualize paint shades with realistic lighting, shadows, and texture.</p></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {[
        { id: "interior" as const, title: "Interior", description: "Rooms, bedrooms, living rooms, offices." },
        { id: "exterior" as const, title: "Exterior", description: "House fronts, facades, boundary walls." },
      ].map(option => {
        const active = projectType === option.id;
        return <button key={option.id} type="button" onClick={() => setProjectType(option.id)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-ink bg-ink text-white shadow-lg" : "border-[#dbe3da] bg-white/85 text-ink hover:border-[#9bad9f]"}`}>
          <span className="flex items-center justify-between gap-3"><span className="text-lg font-bold">{option.title}</span><span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${active ? "border-white bg-white text-ink" : "border-[#c7d0c7] text-transparent"}`}>✓</span></span>
          <span className={`mt-1 block text-sm leading-5 ${active ? "text-white/75" : "text-slate-500"}`}>{option.description}</span>
        </button>;
      })}
    </div>
    <div onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }} className="panel flex min-h-80 flex-col items-center justify-center border-2 border-dashed border-[#c7d0c7] px-6 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#e3ebe4] text-2xl">↑</div><h2 className="m-0 text-xl font-semibold">{projectType === "exterior" ? "Upload a house front or exterior wall photo" : "Upload an interior room photo"}</h2><p className="mb-6 mt-2 text-slate-500">Drag and drop here, or choose one from your computer</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => { if (browseInput.current) browseInput.current.value = ""; browseInput.current?.click(); }} className="rounded-xl bg-ink px-5 py-3 font-semibold text-white hover:bg-[#2a3932]">Browse Image</button>
        <button type="button" onClick={() => { if (cameraInput.current) cameraInput.current.value = ""; cameraInput.current?.click(); }} className="rounded-xl border border-[#c7d0c7] bg-white px-5 py-3 font-semibold text-ink hover:border-ink">Take Photo</button>
      </div>
      <input ref={browseInput} className="hidden" type="file" accept="image/*,.heic,.heif" onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])} />
      <input ref={cameraInput} className="hidden" type="file" accept="image/*,.heic,.heif" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])} />
      <p className="mt-6 text-sm text-slate-500">JPG, PNG, WEBP, HEIC, or HEIF · Up to 10 MB · Images are not permanently stored</p>{error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </div>
  </section>;
}
