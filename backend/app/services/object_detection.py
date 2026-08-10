from PIL import Image
from app.schemas.analysis import BoundingBox, DetectedObject


class ObjectDetectionService:
    def __init__(self, model_name: str, enabled: bool = True) -> None:
        self.model_name, self.enabled, self.model = model_name, enabled, None

    def _load(self) -> None:
        if self.model is None and self.enabled:
            from ultralytics import YOLO
            self.model = YOLO(self.model_name)

    def detect(self, image: Image.Image) -> list[DetectedObject]:
        if not self.enabled:
            return []
        self._load()
        result = self.model(image, verbose=False)[0]
        names = result.names
        return [DetectedObject(id=f"object-{index + 1}", label=str(names[int(box.cls[0])]), confidence=float(box.conf[0]), box=BoundingBox(x1=int(box.xyxy[0][0]), y1=int(box.xyxy[0][1]), x2=int(box.xyxy[0][2]), y2=int(box.xyxy[0][3]))) for index, box in enumerate(result.boxes)]
