import base64
import sys
import types

from app.services.wall_color_edit import CloudflareFluxProvider, FalQwenProvider, GeminiProvider, NEGATIVE_REPAINT_ONLY_PROMPT, OpenAIImageProvider, SelectedColor, build_cloudflare_wall_color_prompt, build_openai_wall_color_prompt, build_wall_color_prompt


def test_wall_color_prompt_includes_exact_color_and_preservation_rules() -> None:
    prompt = build_wall_color_prompt(SelectedColor("#C62828", "Red"))
    assert "HEX #C62828" in prompt
    assert "RGB (198, 40, 40)" in prompt
    assert "Do not paint over foreground objects" in prompt
    assert "STRICT REPAINT-ONLY RULES" in prompt
    assert "Do not alter TV screens" in prompt
    assert "Keep every non-wall pixel visually identical" in prompt


def test_cloudflare_prompt_protects_objects_and_screen_content() -> None:
    prompt = build_cloudflare_wall_color_prompt(SelectedColor("#D5E0D7", "Soft sage"))
    assert "Only change the color of visible paintable wall surfaces" in prompt
    assert "Do not change TV/video/screen contents" in prompt
    assert "framed photos" in prompt
    assert "cables" in prompt
    assert "electrical outlets" in prompt
    assert "exact same photograph" in prompt


def test_openai_prompt_includes_mask_guidance() -> None:
    prompt = build_openai_wall_color_prompt(SelectedColor("#D9A6A2", "Soft rose", selected_mask=b"mask"))
    assert "MASK GUIDANCE" in prompt
    assert "Transparent mask pixels mark the ONLY selected wall area" in prompt
    assert "Opaque mask pixels must remain visually unchanged" in prompt


def test_negative_prompt_blocks_common_hallucinations() -> None:
    assert "changed TV screen" in NEGATIVE_REPAINT_ONLY_PROMPT
    assert "changed picture" in NEGATIVE_REPAINT_ONLY_PROMPT
    assert "added wall art" in NEGATIVE_REPAINT_ONLY_PROMPT
    assert "object hallucination" in NEGATIVE_REPAINT_ONLY_PROMPT


def test_fal_provider_returns_only_the_remote_generated_image(monkeypatch) -> None:
    uploaded = "https://fal.example/original.png"
    generated = b"qwen-generated-image"
    fake_fal = types.SimpleNamespace(
        upload=lambda data, content_type, file_name=None: uploaded,
        subscribe=lambda model, arguments: {"images": [{"url": "https://fal.example/result.png", "width": 1376, "height": 768, "content_type": "image/png"}]},
    )
    monkeypatch.setitem(sys.modules, "fal_client", fake_fal)

    class Downloaded:
        content = generated
        def raise_for_status(self) -> None: pass

    monkeypatch.setattr("app.services.wall_color_edit.httpx.get", lambda url, timeout: Downloaded())
    result = FalQwenProvider("test-key", "fal-ai/qwen-image-edit-2511", 10).edit_wall_color(b"original", "room.png", "image/png", SelectedColor("#C62828", "Red"))

    assert result.image == generated
    assert result.provider == "qwen-fal"
    assert (result.width, result.height) == (1376, 768)


def test_gemini_provider_returns_the_interactions_api_image(monkeypatch) -> None:
    from io import BytesIO
    from PIL import Image

    output = BytesIO()
    Image.new("RGB", (12, 8), "red").save(output, format="PNG")

    class Interaction:
        output_image = types.SimpleNamespace(data=base64.b64encode(output.getvalue()).decode("ascii"))

    calls = {}
    class Interactions:
        def create(self, **kwargs):
            calls.update(kwargs)
            return Interaction()
    fake_genai = types.SimpleNamespace(Client=lambda api_key: types.SimpleNamespace(interactions=Interactions()))
    monkeypatch.setitem(sys.modules, "google", types.SimpleNamespace(genai=fake_genai))
    result = GeminiProvider("test-key", "gemini-3.1-flash-image", 10).edit_wall_color(b"source", "room.png", "image/png", SelectedColor("#C62828", "Red"))

    assert result.provider == "gemini"
    assert (result.width, result.height) == (12, 8)
    assert calls["model"] == "gemini-3.1-flash-image"
    assert calls["input"][0]["type"] == "text"
    assert calls["input"][1]["type"] == "image"
    assert calls["response_format"] == {"type": "image"}


def test_cloudflare_provider_resizes_reference_and_returns_generated_image(monkeypatch) -> None:
    from io import BytesIO
    from PIL import Image

    original = BytesIO()
    Image.new("RGB", (750, 500), "white").save(original, format="PNG")
    generated = BytesIO()
    Image.new("RGB", (1024, 683), "red").save(generated, format="PNG")
    captured = {}

    class Response:
        headers = {"content-type": "image/png"}
        content = generated.getvalue()
        def raise_for_status(self) -> None: pass

    def fake_post(url, *, headers, data, files, timeout):
        captured.update({"url": url, "headers": headers, "data": data, "files": files})
        return Response()

    monkeypatch.setattr("app.services.wall_color_edit.httpx.post", fake_post)
    result = CloudflareFluxProvider("account", "token", "@cf/black-forest-labs/flux-2-klein-4b", 10).edit_wall_color(original.getvalue(), "room.png", "image/png", SelectedColor("#C62828", "Red"))

    reference = Image.open(BytesIO(captured["files"]["input_image_0"][1]))
    assert reference.size == (511, 341)
    assert captured["data"]["width"] == "1024"
    assert captured["data"]["height"] == "683"
    assert "Bearer token" == captured["headers"]["Authorization"]
    assert result.provider == "cloudflare-flux"
    assert (result.width, result.height) == (1024, 683)


def test_openai_provider_sends_mask_and_returns_generated_image(monkeypatch) -> None:
    from io import BytesIO
    from PIL import Image

    original = BytesIO()
    Image.new("RGB", (80, 60), "white").save(original, format="JPEG")
    selected_mask = BytesIO()
    Image.new("L", (80, 60), 0).save(selected_mask, format="PNG")
    generated = BytesIO()
    Image.new("RGB", (80, 60), "red").save(generated, format="PNG")
    captured = {}

    class Response:
        def raise_for_status(self) -> None: pass
        def json(self) -> dict:
            return {"data": [{"b64_json": base64.b64encode(generated.getvalue()).decode("ascii")}]}

    def fake_post(url, *, headers, data, files, timeout):
        captured.update({"url": url, "headers": headers, "data": data, "files": files})
        return Response()

    monkeypatch.setattr("app.services.wall_color_edit.httpx.post", fake_post)
    result = OpenAIImageProvider("openai-key", "gpt-image-2", 10).edit_wall_color(
        original.getvalue(),
        "room.jpg",
        "image/jpeg",
        SelectedColor("#C62828", "Red", selected_mask=selected_mask.getvalue()),
    )

    input_image = Image.open(BytesIO(captured["files"]["image"][1]))
    edit_mask = Image.open(BytesIO(captured["files"]["mask"][1]))
    assert captured["url"] == "https://api.openai.com/v1/images/edits"
    assert captured["headers"]["Authorization"] == "Bearer openai-key"
    assert captured["data"]["model"] == "gpt-image-2"
    assert "MASK GUIDANCE" in captured["data"]["prompt"]
    assert input_image.size == (80, 60)
    assert edit_mask.size == (80, 60)
    assert result.provider == "openai-image"
    assert (result.width, result.height) == (80, 60)
