from base64 import b64encode
from io import BytesIO
import cv2
import numpy as np
from PIL import Image
from app.schemas.analysis import BoundingBox, Surface, WallRegion


def mask_to_base64_png(mask: np.ndarray) -> str:
    buffer = BytesIO()
    Image.fromarray(mask.astype(np.uint8) * 255, mode="L").save(buffer, format="PNG", optimize=True)
    return b64encode(buffer.getvalue()).decode("ascii")


class WallRegionService:
    """Converts a semantic wall mask into selectable disconnected components."""
    def __init__(self, minimum_area: int = 2000, confidence_threshold: float = 0.35) -> None:
        self.minimum_area = minimum_area
        self.confidence_threshold = confidence_threshold

    def _wall_region(self, mask: np.ndarray, confidence: float, region_number: int) -> WallRegion:
        ys, xs = np.where(mask)
        x1, x2 = int(xs.min()), int(xs.max()) + 1
        y1, y2 = int(ys.min()), int(ys.max()) + 1
        return WallRegion(
            id=f"wall-{region_number}",
            confidence=confidence,
            mask=mask_to_base64_png(mask),
            area=int(mask.sum()),
            boundingBox=BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2),
        )

    def _split_large_exterior_component(self, component: np.ndarray) -> list[np.ndarray]:
        """Split a connected exterior facade into real mask-backed vertical regions.

        Semantic segmentation often returns one connected building/facade mask for
        several visually separate exterior planes. These slices are intentionally
        conservative: every returned region is still the original mask intersected
        with a vertical band, so the UI never shows a fake rectangular area.
        """
        height, width = component.shape
        ys, xs = np.where(component)
        if not len(xs):
            return []
        x1, x2 = int(xs.min()), int(xs.max()) + 1
        y1, y2 = int(ys.min()), int(ys.max()) + 1
        box_width = x2 - x1
        box_height = y2 - y1
        if box_width < width * 0.32 or int(component.sum()) < self.minimum_area * 3:
            return [component]

        column_density = component[y1:y2, x1:x2].sum(axis=0)
        gap_threshold = max(3, int(box_height * 0.04))
        gap_columns = np.where(column_density <= gap_threshold)[0]
        split_positions: list[int] = []
        if len(gap_columns):
            groups = np.split(gap_columns, np.where(np.diff(gap_columns) > 1)[0] + 1)
            for group in groups:
                if len(group) >= max(4, int(box_width * 0.025)):
                    split_positions.append(x1 + int(group[len(group) // 2]))

        target_parts = min(5, max(2, round(box_width / max(1, width * 0.22))))
        even_positions = [x1 + round(box_width * index / target_parts) for index in range(1, target_parts)]
        candidates = sorted({pos for pos in split_positions + even_positions if x1 + 8 < pos < x2 - 8})

        regions: list[np.ndarray] = []
        start = x1
        for end in [*candidates, x2]:
            part = np.zeros_like(component)
            part[:, start:end] = component[:, start:end]
            if int(part.sum()) >= self.minimum_area:
                regions.append(part)
            start = end
        return regions or [component]

    def extract_walls(self, wall_mask: np.ndarray, confidence: float = 0.85, split_large_regions: bool = False) -> list[WallRegion]:
        count, labels, stats, _ = cv2.connectedComponentsWithStats(wall_mask.astype(np.uint8), connectivity=8)
        regions: list[WallRegion] = []
        for index in range(1, count):
            _, _, _, _, area = (int(v) for v in stats[index])
            if area < self.minimum_area:
                continue
            # Keep a large contiguous facade even at lower semantic confidence;
            # geometry is a stronger signal than a high global cutoff outdoors.
            if confidence < self.confidence_threshold and area < self.minimum_area * 2:
                continue
            component = labels == index
            parts = self._split_large_exterior_component(component) if split_large_regions else [component]
            for part in parts:
                if int(part.sum()) >= self.minimum_area:
                    regions.append(self._wall_region(part, confidence, len(regions) + 1))
        return regions

    def surfaces(self, masks: dict[str, np.ndarray]) -> list[Surface]:
        return [Surface(label=label, mask=mask_to_base64_png(mask)) for label, mask in masks.items() if mask.any()]
