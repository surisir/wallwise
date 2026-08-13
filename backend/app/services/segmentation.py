import numpy as np
from PIL import Image


class RoomSegmentationService:
    """ADE20K adapter. Replace this class later for a wall-instance model."""
    TARGETS = {
        "wall": ("wall",),
        # Exterior facades are commonly classified as building/house/edifice by
        # ADE20K rather than the interior "wall" class.
        "facade": ("building", "house", "facade", "edifice"),
        "floor": ("floor",),
        "ceiling": ("ceiling",),
        # ADE20K names this architectural class "windowpane".
        "window": ("window", "windowpane"),
        "door": ("door", "screen door"),
        "roof": ("roof",),
        "sky": ("sky",),
        "pavement": ("pavement", "road", "path"),
    }
    FOREGROUND = ("plant", "bed", "cabinet", "table", "curtain", "chair", "sofa", "shelf", "mirror", "armchair", "lamp", "poster", "screen")

    def __init__(self, model_name: str) -> None:
        self.model_name, self.processor, self.model = model_name, None, None
        self.last_debug: dict[str, object] = {}

    def _load(self) -> None:
        if self.model is None:
            from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
            self.processor = AutoImageProcessor.from_pretrained(self.model_name)
            self.model = AutoModelForSemanticSegmentation.from_pretrained(self.model_name)
            self.model.eval()

    @staticmethod
    def clean_wall_mask(wall: np.ndarray, protected: np.ndarray) -> np.ndarray:
        """Fill only tiny interior gaps, then enforce architectural/object protection."""
        import cv2

        kernel = np.ones((3, 3), np.uint8)
        closed = cv2.morphologyEx(wall.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)
        return closed & ~protected

    @staticmethod
    def _resize_mask(mask: np.ndarray, size: tuple[int, int]) -> np.ndarray:
        """Resize a boolean class mask to image coordinates without soft edges."""
        if mask.shape == (size[1], size[0]):
            return mask
        resized = Image.fromarray(mask.astype(np.uint8) * 255, mode="L").resize(size, Image.Resampling.NEAREST)
        return np.asarray(resized) > 0

    def segment(self, image: Image.Image) -> tuple[dict[str, np.ndarray], float]:
        self._load()
        import torch
        inputs = self.processor(images=image, return_tensors="pt")
        with torch.no_grad():
            logits = self.model(**inputs).logits

        # Keep inference responsive on small production CPU containers.
        # Previously this upscaled the full 150-class logits tensor to the image
        # size before argmax/softmax. For large-but-compressed phone photos that
        # made a small upload produce a huge tensor and Railway could time out.
        # Instead, classify at the model's native output resolution and upscale
        # only the final boolean masks to the analysis-image coordinates.
        probabilities = logits.softmax(dim=1)[0]
        labels = probabilities.argmax(dim=0).cpu().numpy()
        id2label = {int(key): value.lower().strip() for key, value in self.model.config.id2label.items()}
        raw_masks: dict[str, np.ndarray] = {}
        target_ids: dict[str, list[int]] = {}
        for target, aliases in self.TARGETS.items():
            ids = [key for key, label in id2label.items() if any(label == alias or label.startswith(alias + ",") for alias in aliases)]
            target_ids[target] = ids
            mask = np.isin(labels, ids) if ids else np.zeros(labels.shape, dtype=bool)
            raw_masks[target] = mask
        foreground_ids = [key for key, label in id2label.items() if label in self.FOREGROUND]
        raw_masks["foreground"] = np.isin(labels, foreground_ids) if foreground_ids else np.zeros(labels.shape, dtype=bool)
        # A large building prediction combined with outdoor context is a facade.
        # Otherwise retaining only "wall" prevents exterior labels from leaking
        # into indoor scene analysis.
        facade_area = float(raw_masks["facade"].mean())
        outdoor_context = float((raw_masks["sky"] | raw_masks["pavement"] | raw_masks["foreground"]).mean())
        is_exterior = facade_area >= 0.03 and (facade_area >= float(raw_masks["wall"].mean()) or outdoor_context >= 0.02)
        candidate_ids = target_ids["wall"] + (target_ids["facade"] if is_exterior else [])
        candidates = np.isin(labels, candidate_ids) if candidate_ids else np.zeros(labels.shape, dtype=bool)
        # Openings, roof/ceiling, ground, vegetation, furniture and glass-like
        # architecture remain protected even within a detected building region.
        protected = raw_masks["window"] | raw_masks["door"] | raw_masks["floor"] | raw_masks["ceiling"] | raw_masks["roof"] | raw_masks["sky"] | raw_masks["pavement"] | raw_masks["foreground"]
        raw_wall = self.clean_wall_mask(candidates, protected)
        wall_confidence = float(probabilities[candidate_ids].amax(dim=0)[raw_wall].mean().cpu()) if candidate_ids and raw_wall.any() else 0.0

        masks = {
            key: self._resize_mask(mask, image.size)
            for key, mask in raw_masks.items()
            if key != "wall"
        }
        resized_candidates = self._resize_mask(candidates, image.size)
        resized_protected = (
            masks["window"]
            | masks["door"]
            | masks["floor"]
            | masks["ceiling"]
            | masks["roof"]
            | masks["sky"]
            | masks["pavement"]
            | masks["foreground"]
        )
        masks["wall"] = self.clean_wall_mask(resized_candidates, resized_protected)
        counts = np.bincount(labels.ravel(), minlength=len(id2label))
        top_ids = counts.argsort()[-8:][::-1]
        self.last_debug = {
            "scene_type": "exterior" if is_exterior else "interior",
            "top_classes": [{"label": id2label.get(int(index), str(index)), "pixel_percent": round(float(counts[index] / labels.size * 100), 2)} for index in top_ids if counts[index]],
            "facade_candidate_percent": round(facade_area * 100, 2),
            "wall_candidate_percent": round(float(masks["wall"].mean()) * 100, 2),
            "candidate_confidence": round(wall_confidence, 4),
            "native_output_size": f"{labels.shape[1]}x{labels.shape[0]}",
            "analysis_size": f"{image.width}x{image.height}",
        }
        return masks, wall_confidence
