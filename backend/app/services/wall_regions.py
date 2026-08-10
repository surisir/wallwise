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

    def extract_walls(self, wall_mask: np.ndarray, confidence: float = 0.85) -> list[WallRegion]:
        count, labels, stats, _ = cv2.connectedComponentsWithStats(wall_mask.astype(np.uint8), connectivity=8)
        regions: list[WallRegion] = []
        for index in range(1, count):
            x, y, width, height, area = (int(v) for v in stats[index])
            if area < self.minimum_area:
                continue
            # Keep a large contiguous facade even at lower semantic confidence;
            # geometry is a stronger signal than a high global cutoff outdoors.
            if confidence < self.confidence_threshold and area < self.minimum_area * 2:
                continue
            regions.append(WallRegion(id=f"wall-{len(regions) + 1}", confidence=confidence, mask=mask_to_base64_png(labels == index), area=area, boundingBox=BoundingBox(x1=x, y1=y, x2=x + width, y2=y + height)))
        return regions

    def surfaces(self, masks: dict[str, np.ndarray]) -> list[Surface]:
        return [Surface(label=label, mask=mask_to_base64_png(mask)) for label, mask in masks.items() if mask.any()]
