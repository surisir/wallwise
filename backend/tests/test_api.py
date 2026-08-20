import base64
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
                "target_points": '[{"id":"wall-1","x":20,"y":30,"xPercent":25,"yPercent":37.5}]',
            },
        )

    assert response.status_code == 200
    assert response.headers["x-image-provider"] == "test"


def test_visualize_sends_selected_and_deselected_exterior_guidance(monkeypatch) -> None:
    import app.api.routes as routes

    class Provider:
        def edit_wall_color(self, original, filename, content_type, color):
            assert "This is a targeted repaint, not a full-facade repaint" in color.scene_hint
            assert "wall-1 at image coordinate (20, 30)" in color.scene_hint
            assert "approximately 25% from the left and 37.5% from the top" in color.scene_hint
            assert "wall-2 at image coordinate (60, 30)" in color.scene_hint
            assert "must remain their original color" in color.scene_hint
            assert "neighboring buildings" in color.scene_hint
            assert "left/right side facades" in color.scene_hint
            buffer = BytesIO()
            Image.new("RGB", (16, 16), "red").save(buffer, "PNG")
            return ImageEditResult(buffer.getvalue(), "image/png", 16, 16, 25, "test")

    monkeypatch.setattr(routes, "create_image_editing_provider", lambda settings: Provider())

    source = BytesIO()
    Image.new("RGB", (80, 80)).save(source, "PNG")

    with TestClient(app) as client:
        response = client.post(
            "/visualize",
            files={"image": ("facade.png", source.getvalue(), "image/png")},
            data={
                "color_hex": "#D9A6A2",
                "color_rgb": "217,166,162",
                "project_type": "exterior",
                "selected_area_ids": '["wall-1"]',
                "target_points": '[{"id":"wall-1","x":20,"y":30,"xPercent":25,"yPercent":37.5}]',
                "excluded_points": '[{"id":"wall-2","x":60,"y":30,"xPercent":75,"yPercent":37.5}]',
            },
        )

    assert response.status_code == 200


def test_visualize_passes_selected_mask_to_provider(monkeypatch) -> None:
    import app.api.routes as routes

    mask = BytesIO()
    Image.new("L", (80, 80), 255).save(mask, "PNG")
    encoded_mask = base64.b64encode(mask.getvalue()).decode("ascii")

    class Provider:
        def edit_wall_color(self, original, filename, content_type, color):
            assert color.selected_mask == mask.getvalue()
            assert "Image 1 is a black-and-white selection mask" in color.scene_hint
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
                "target_points": '[{"id":"wall-1","x":20,"y":30,"xPercent":25,"yPercent":37.5}]',
                "selected_mask": encoded_mask,
            },
        )

    assert response.status_code == 200


def test_visualize_adds_lighting_guidance(monkeypatch) -> None:
    import app.api.routes as routes

    class Provider:
        def edit_wall_color(self, original, filename, content_type, color):
            assert "Lighting slider guidance: value 95/100" in color.scene_hint
            assert "strong direct sunlight" in color.scene_hint
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
                "lighting_value": "95",
                "lighting_label": "Direct sunlight",
            },
        )

    assert response.status_code == 200


def test_visualize_rejects_invalid_lighting_value() -> None:
    source = BytesIO()
    Image.new("RGB", (80, 80)).save(source, "PNG")

    with TestClient(app) as client:
        response = client.post(
            "/visualize",
            files={"image": ("room.png", source.getvalue(), "image/png")},
            data={
                "color_hex": "#AA0000",
                "color_rgb": "170,0,0",
                "lighting_value": "101",
            },
        )

    assert response.status_code == 422
