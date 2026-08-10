"use client";
import { useState } from "react";
import { analyzeRoom } from "@/lib/api";
import { AnalysisResult } from "@/types/analysis";
import { ErrorState } from "@/components/ErrorState";
import { ImageEditor } from "@/components/ImageEditor";
import { ImageUploader } from "@/components/ImageUploader";
import { LoadingState } from "@/components/LoadingState";

export default function Home() {
  const [state, setState] = useState<"upload" | "loading" | "editor" | "error">("upload"); const [originalSource, setOriginalSource] = useState(""); const [originalFile, setOriginalFile] = useState<File | null>(null); const [analysis, setAnalysis] = useState<AnalysisResult | null>(null); const [error, setError] = useState("");
  const upload = async (file: File) => { setState("loading"); setOriginalSource(URL.createObjectURL(file)); setOriginalFile(file); try { setAnalysis(await analyzeRoom(file)); setState("editor"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unexpected error"); setState("error"); } };
  if (state === "loading") return <LoadingState />; if (state === "error") return <ErrorState message={error} onTryAgain={() => setState("upload")} />; if (state === "editor" && analysis && originalFile) return <ImageEditor originalSource={originalSource} originalFile={originalFile} analysis={analysis} onStartOver={() => setState("upload")} />; return <ImageUploader onUpload={upload} />;
}
