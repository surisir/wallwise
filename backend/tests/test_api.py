from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app

def test_health() -> None:
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}


def test_invalid_file_is_rejected() -> None:
    with TestClient(app) as client:
        response = client.post("/analyze", files={"image": ("bad.txt", b"nope", "text/plain")})
    assert response.status_code == 415


def test_valid_image_uses_response_schema(monkeypatch) -> None:
    import numpy as np
    from app.services.object_detection import ObjectDetectionService
    from app.services.segmentation import RoomSegmentationService
    masks = {"wall": np.ones((80, 80), dtype=bool), "floor": np.zeros((80, 80), dtype=bool), "ceiling": np.zeros((80, 80), dtype=bool), "window": np.zeros((80, 80), dtype=bool), "door": np.zeros((80, 80), dtype=bool)}
    monkeypatch.setattr(RoomSegmentationService, "segment", lambda self, image: (masks, 0.9))
    monkeypatch.setattr(ObjectDetectionService, "detect", lambda self, image: [])
    buffer = BytesIO()
    Image.new("RGB", (80, 80)).save(buffer, "PNG")
    with TestClient(app) as client:
        response = client.post("/analyze", files={"image": ("room.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 200
    assert response.json()["image"] == {"width": 80, "height": 80}
