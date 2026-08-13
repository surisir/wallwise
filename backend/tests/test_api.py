from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.services.wall_color_edit import ImageEditResult

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


def test_visualize_accepts_target_points(monkeypatch) -> None:
    import app.api.routes as routes

    class Provider:
        def edit_wall_color(self, original, filename, content_type, color):
            assert "wall-1 at image coordinate (20, 30)" in color.scene_hint
            buffer = BytesIO()
            Image.new("RGB", (16, 16), "red").save(buffer, "PNG")
            return ImageEditResult(buffer.getvalue(), "image/png", 16, 16, 25, "test")

    monkeypatch.setattr(routes, "create_image_editing_provider", lambda settings: Provider())

    source = BytesIO()
    Image.new("RGB", (80, 80)).save(source, "PNG")

    with TestClient(app) as client:
        response = client.post(
            "/visualize",
            files={"image": ("room.png", source.getvalue(), "image/png")},
            data={
                "color_hex": "#AA0000",
                "color_rgb": "170,0,0",
                "selected_area_ids": '["wall-1"]',
                "target_points": '[{"id":"wall-1","x":20,"y":30}]',
            },
        )

    assert response.status_code == 200
    assert response.headers["x-image-provider"] == "test"
