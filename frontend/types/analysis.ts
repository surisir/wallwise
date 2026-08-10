export type BoundingBox = { x1: number; y1: number; x2: number; y2: number };
export type DetectedObject = { id: string; label: string; confidence: number; box: BoundingBox };
export type WallRegion = { id: string; confidence: number; mask: string; boundingBox: BoundingBox; area: number };
export type Surface = { label: string; mask: string };
export type AnalysisResult = { image: { width: number; height: number }; objects: DetectedObject[]; walls: WallRegion[]; surfaces: Surface[] };
