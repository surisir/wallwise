from __future__ import annotations

import os
import time
import base64
import json
import logging
import re
from dataclasses import dataclass
from io import BytesIO
from typing import NamedTuple, Protocol

import httpx
from fastapi import HTTPException

from app.core.config import Settings

logger = logging.getLogger(__name__)


class SelectedColor(NamedTuple):
    hex: str
    name: str | None
    scene_hint: str | None = None
    selected_mask: bytes | None = None
    excluded_mask: bytes | None = None

    @property
    def rgb(self) -> tuple[int, int, int]:
        value = self.hex.lstrip("#")
        return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)

    @property
    def descriptive_name(self) -> str:
        if self.name:
            return self.name
        red, green, blue = self.rgb
        if max(red, green, blue) - min(red, green, blue) < 20:
            return "gray"
        if red >= green and red >= blue:
            return "red"
        if green >= red and green >= blue:
            return "green"
        return "blue"


STRICT_REPAINT_ONLY_RULES = """STRICT REPAINT-ONLY RULES:
- This is a repaint-only edit, not a redesign or image regeneration.
- Only change the color of visible paintable wall surfaces.
- Keep every non-wall pixel visually identical except for natural edge preservation.
- Do not add, remove, move, replace, resize, duplicate, redraw, invent, or reinterpret anything.
- Do not alter TV screens, screen content, photos, portraits, picture frames, artwork, wall decorations, cables, outlets, switches, plugs, furniture, curtains, trim, doors, windows, glass, ceiling, floor, baseboards, fixtures, plants, reflections, shadows, or object placement.
- Preserve all existing object boundaries exactly. Paint must stop cleanly behind and around mounted TVs, frames, wires, outlets, chairs, tables, plants, trim, and decorations.
- If an object overlaps a wall, leave the object unchanged and repaint only the visible wall around it."""

NEGATIVE_REPAINT_ONLY_PROMPT = (
    "redesign, changed architecture, changed furniture, changed ceiling, painted windows, "
    "painted trim, painted objects, added objects, removed objects, moved objects, resized objects, "
    "duplicated objects, redrawn objects, changed TV screen, changed screen content, changed picture, "
    "changed portrait, changed wall art, added wall art, removed wall art, new decorations, object hallucination, "
    "changed cables, changed outlets, changed switches, changed furniture, flat color overlay, illustration, CGI"
)


def build_wall_color_prompt(color: SelectedColor) -> str:
    red, green, blue = color.rgb
    fallback = f"\n\nAI FALLBACK INSTRUCTION:\n{color.scene_hint}" if color.scene_hint else ""
    return f"""Edit the supplied room photograph into a photorealistic professional repaint.

Change ONLY paintable wall surfaces to the requested paint color: {color.descriptive_name},
HEX {color.hex}, RGB ({red}, {green}, {blue}). This is a precise image edit, never a redesign.

{STRICT_REPAINT_ONLY_RULES}

Preserve exactly: furniture, beds, tables, cabinets, plants, artwork, wall decorations,
windows, glass, window frames, trim, doors, baseboards, crown molding, ceiling, flooring,
rugs, outlets, switches, lamps, exterior view, room architecture, camera viewpoint,
perspective, composition, object placement, lighting direction, shadows, highlights and
reflections. Do not add, remove, move, replace, or redesign anything.

Do not paint over foreground objects, window trim, ceiling, floor, or any architectural
detail. Keep clean natural boundaries around thin details such as plant leaves, furniture
legs, wall art, headboards and trim. Preserve realistic wall texture and illumination: bright
areas remain bright and shadowed areas remain dark while still reading as {color.hex} paint.

Return only the same photograph after a believable, accurate wall repaint.{fallback}"""


@dataclass(frozen=True)
class ImageEditResult:
    image: bytes
    content_type: str
    width: int
    height: int
    generation_time_ms: int
    provider: str
    neuron_usage: float | None = None


class ImageEditingProvider(Protocol):
    """Server-side provider contract. The browser receives only the final image bytes."""

    def edit_wall_color(self, original: bytes, filename: str, content_type: str, color: SelectedColor) -> ImageEditResult: ...


class FalQwenProvider:
    """Remote Qwen Image Edit 2511 adapter backed by fal's Python client."""

    provider_name = "qwen-fal"

    def __init__(self, api_key: str | None, model: str, download_timeout_seconds: int) -> None:
        self.api_key = api_key
        self.model = model
        self.download_timeout_seconds = download_timeout_seconds

    def edit_wall_color(self, original: bytes, filename: str, content_type: str, color: SelectedColor) -> ImageEditResult:
        if not self.api_key:
            raise HTTPException(503, "Image editing is not configured. Set FAL_KEY on the backend server.")

        # fal-client reads credentials from the server process environment. This assignment is
        # deliberately server-only; no credentials are returned from this provider or endpoint.
        os.environ["FAL_KEY"] = self.api_key
        try:
            import fal_client

            started_at = time.perf_counter()
            uploaded_image_url = fal_client.upload(original, content_type, file_name=filename)
            response = fal_client.subscribe(
                self.model,
                arguments={
                    "prompt": build_wall_color_prompt(color),
                    "negative_prompt": NEGATIVE_REPAINT_ONLY_PROMPT,
                    "image_urls": [uploaded_image_url],
                    "num_images": 1,
                    "num_inference_steps": 28,
                    "guidance_scale": 4.5,
                    "output_format": "png",
                    "acceleration": "regular",
                    "enable_safety_checker": True,
                },
            )
            generation_time_ms = round((time.perf_counter() - started_at) * 1000)
        except Exception as exc:
            message = str(exc).lower()
            if "authentication" in message or "unauthorized" in message or "forbidden" in message or "403" in message or "api key" in message:
                raise HTTPException(502, "fal rejected the server credentials or storage access. Check FAL_KEY and the fal account access.") from exc
            if "timeout" in message:
                raise HTTPException(504, "Qwen image editing timed out. Please try again.") from exc
            raise HTTPException(502, "Qwen image editing failed. Please try again.") from exc

        try:
            generated = response["images"][0]
            image_url = generated["url"]
            width = int(generated["width"])
            height = int(generated["height"])
            result_content_type = generated.get("content_type") or "image/png"
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise HTTPException(502, "Qwen image editing returned no usable image.") from exc

        try:
            downloaded = httpx.get(image_url, timeout=self.download_timeout_seconds)
            downloaded.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(502, "The generated Qwen image could not be retrieved.") from exc
        return ImageEditResult(downloaded.content, result_content_type, width, height, generation_time_ms, self.provider_name)


class GeminiProvider:
    """Google AI Studio Gemini image-edit adapter using Interactions API."""

    provider_name = "gemini"

    def __init__(self, api_key: str | None, model: str, timeout_seconds: int) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def _safe_error_details(self, exc: Exception) -> tuple[int | None, str | None, str, str]:
        """Extract Gemini diagnostics without ever allowing credentials into logs."""
        body = str(exc)
        if self.api_key:
            body = body.replace(self.api_key, "[REDACTED]")
        raw_body = getattr(exc, "body", None)
        status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
        if not isinstance(status, int):
            match = re.match(r"(\d{3})\s", body)
            status = int(match.group(1)) if match else None
        error_code = None
        message = body
        if isinstance(raw_body, dict):
            body = json.dumps(raw_body, ensure_ascii=False)
            if self.api_key:
                body = body.replace(self.api_key, "[REDACTED]")
            error = raw_body.get("error")
            if isinstance(error, dict):
                error_code = str(error.get("code")) if error.get("code") is not None else None
                message = str(error.get("message") or body)
        match = re.search(r"'status':\s*'([^']+)'", body)
        if match and not error_code:
            error_code = match.group(1)
        match = re.search(r"'message':\s*'([^']+)'", body)
        if match and message == body:
            message = match.group(1)
        return status, error_code, message, body

    def _log_failure(self, stage: str, exc: Exception) -> tuple[int | None, str | None, str]:
        status, error_code, message, body = self._safe_error_details(exc)
        logger.error(
            "Gemini image edit failed stage=%s http_status=%s gemini_error_code=%s gemini_error_message=%s response_body=%s",
            stage,
            status,
            error_code,
            message,
            body,
        )
        return status, error_code, message

    def edit_wall_color(self, original: bytes, filename: str, content_type: str, color: SelectedColor) -> ImageEditResult:
        if not self.api_key:
            raise HTTPException(503, "Image editing is not configured. Set GEMINI_API_KEY on the backend server.")
        actual_mime_type = content_type.split(";", 1)[0].strip() or "image/png"
        input_parts = [
            {"type": "text", "text": build_wall_color_prompt(color)},
            {"type": "image", "mime_type": actual_mime_type, "data": base64.b64encode(original).decode("ascii")},
        ]
        started_at = time.perf_counter()
        try:
            from google import genai

            # Explicit server-side credential injection; never rely on automatic discovery.
            client = genai.Client(api_key=self.api_key.strip())
        except Exception as exc:
            _, _, message = self._log_failure("before_gemini_request", exc)
            raise HTTPException(500, f"Gemini provider initialization failed: {message}") from exc

        try:
            interaction = client.interactions.create(
                model=self.model,
                input=input_parts,
                response_format={"type": "image"},
            )
        except Exception as exc:
            status, error_code, message = self._log_failure("during_gemini_request", exc)
            raise HTTPException(502, f"Gemini request failed (HTTP {status or 'unknown'}, {error_code or 'unknown'}): {message}") from exc

        try:
            output_image = interaction.output_image
            if output_image is None:
                raise ValueError("Gemini returned no output_image.")
            encoded_image = output_image.data
            generated = base64.b64decode(encoded_image, validate=True)
        except (AttributeError, TypeError, ValueError) as exc:
            _, _, message = self._log_failure("after_gemini_return_parsing_output", exc)
            raise HTTPException(502, f"Gemini returned an unusable image output: {message}") from exc
        try:
            from PIL import Image

            with Image.open(BytesIO(generated)) as image:
                width, height = image.size
                detected_content_type = Image.MIME.get(image.format, "image/png")
        except Exception as exc:
            _, _, message = self._log_failure("after_gemini_return_decoding_output", exc)
            raise HTTPException(502, f"Gemini returned malformed image data: {message}") from exc
        return ImageEditResult(generated, detected_content_type, width, height, round((time.perf_counter() - started_at) * 1000), self.provider_name)


def build_cloudflare_wall_color_prompt(color: SelectedColor) -> str:
    red, green, blue = color.rgb
    fallback = f"\n\nAI FALLBACK INSTRUCTION:\n{color.scene_hint}" if color.scene_hint else ""
    mask_instruction = ""
    if color.selected_mask:
        mask_instruction = """

MASK GUIDANCE:
Image 1 is a black-and-white selection mask aligned to image 0.
Repaint ONLY the white area of image 1.
Every black area in image 1 must remain unchanged, even if it is also a wall or facade.
Do not draw the mask, edges, labels, numbers, or any guide marks in the final result."""
        if color.excluded_mask:
            mask_instruction += """
Image 2 is an additional excluded-area mask. Any white area in image 2 must remain its original color."""
    return f"""Edit the supplied photograph.

This is image 0.
{mask_instruction}

Change ONLY the visible paintable wall surfaces in image 0 to:

Color name: {color.descriptive_name}
HEX: {color.hex}
RGB: ({red}, {green}, {blue})

The output must remain the exact same photograph/scene.

{STRICT_REPAINT_ONLY_RULES}

Preserve the furniture, bed, windows, window trim, doors, ceiling, flooring,
plant, artwork, decorations, fixtures and architecture.

Preserve the camera angle, perspective, composition, natural lighting,
shadows and reflections.

Do not add, remove, move, replace, resize, duplicate, or redraw objects.
Do not redesign the room, building, facade, wall, decor, furniture, TV screen, picture frames,
photos, portraits or artwork.
Do not tint furniture.
Do not change the ceiling or flooring.
Do not change TV/video/screen contents, framed photos, wall art, cables,
electrical outlets, switches, plugs, curtains, trim, baseboards, fixtures,
chairs, tables, decor, plants, floor, ceiling or reflections.

The selected HEX represents the underlying paint color; preserve realistic
lighting variations across the painted walls.

The final result must look like the exact same photograph with only the
paintable wall color changed.{fallback}"""


class CloudflareFluxProvider:
    """Cloudflare Workers AI FLUX.2 Klein image-edit provider."""

    provider_name = "cloudflare-flux"
    reference_max_dimension = 511
    output_max_dimension = 1024

    def __init__(self, account_id: str | None, api_token: str | None, model: str, timeout_seconds: int) -> None:
        self.account_id = account_id
        self.api_token = api_token
        self.model = model
        self.timeout_seconds = timeout_seconds

    def _make_reference_image(self, original: bytes) -> tuple[bytes, int, int]:
        from PIL import Image

        with Image.open(BytesIO(original)) as source:
            image = source.convert("RGB")
            image.thumbnail((self.reference_max_dimension, self.reference_max_dimension), Image.Resampling.LANCZOS)
            reference = BytesIO()
            image.save(reference, format="PNG", optimize=True)
            return reference.getvalue(), image.width, image.height

    @staticmethod
    def _make_mask_reference(mask: bytes, size: tuple[int, int]) -> bytes:
        from PIL import Image

        with Image.open(BytesIO(mask)) as source:
            alpha = source.convert("L").resize(size, Image.Resampling.NEAREST)
            reference = BytesIO()
            alpha.save(reference, format="PNG", optimize=True)
            return reference.getvalue()

    @classmethod
    def _output_size(cls, original: bytes) -> tuple[int, int]:
        from PIL import Image

        with Image.open(BytesIO(original)) as image:
            scale = cls.output_max_dimension / max(image.width, image.height)
            width = max(256, round(image.width * scale))
            height = max(256, round(image.height * scale))
            return min(1920, width), min(1920, height)

    @staticmethod
    def _extract_image(response: httpx.Response) -> tuple[bytes, float | None]:
        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        if content_type.startswith("image/"):
            return response.content, None
        body = response.json()
        if not body.get("success", True):
            raise ValueError(json.dumps(body))
        result = body.get("result", body)
        encoded = result.get("image") if isinstance(result, dict) else None
        if not isinstance(encoded, str):
            raise ValueError(json.dumps(body))
        if encoded.startswith("data:"):
            encoded = encoded.split(",", 1)[-1]
        usage = result.get("usage") if isinstance(result, dict) else None
        neurons = None
        if isinstance(usage, dict):
            value = usage.get("neurons") or usage.get("neuron_usage")
            if isinstance(value, (int, float)):
                neurons = float(value)
        return base64.b64decode(encoded), neurons

    def edit_wall_color(self, original: bytes, filename: str, content_type: str, color: SelectedColor) -> ImageEditResult:
        if not self.account_id or not self.api_token:
            raise HTTPException(503, "Cloudflare image editing is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN on the backend server.")
        try:
            reference, input_width, input_height = self._make_reference_image(original)
            output_width, output_height = self._output_size(original)
            selected_mask = self._make_mask_reference(color.selected_mask, (input_width, input_height)) if color.selected_mask else None
            excluded_mask = self._make_mask_reference(color.excluded_mask, (input_width, input_height)) if color.excluded_mask else None
        except Exception as exc:
            raise HTTPException(422, "The uploaded room image could not be prepared for Cloudflare editing.") from exc

        endpoint = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model}"
        started_at = time.perf_counter()
        try:
            files = {"input_image_0": ("room-reference.png", reference, "image/png")}
            if selected_mask:
                files["input_image_1"] = ("selected-wall-mask.png", selected_mask, "image/png")
            if excluded_mask:
                files["input_image_2"] = ("excluded-wall-mask.png", excluded_mask, "image/png")
            response = httpx.post(
                endpoint,
                headers={"Authorization": f"Bearer {self.api_token}"},
                data={"prompt": build_cloudflare_wall_color_prompt(color), "width": str(output_width), "height": str(output_height)},
                files=files,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            safe_body = exc.response.text.replace(self.api_token, "[REDACTED]")
            logger.error("Cloudflare FLUX edit failed http_status=%s response_body=%s", exc.response.status_code, safe_body)
            raise HTTPException(502, f"Cloudflare FLUX request failed (HTTP {exc.response.status_code}): {safe_body}") from exc
        except httpx.HTTPError as exc:
            logger.error("Cloudflare FLUX edit failed before receiving a response: %s", exc)
            raise HTTPException(503, "Cloudflare FLUX is temporarily unavailable.") from exc

        try:
            generated, neuron_usage = self._extract_image(response)
            from PIL import Image

            with Image.open(BytesIO(generated)) as image:
                width, height = image.size
                result_content_type = Image.MIME.get(image.format, "image/png")
        except Exception as exc:
            safe_detail = str(exc).replace(self.api_token, "[REDACTED]")
            logger.error("Cloudflare FLUX returned an unusable image response: %s", safe_detail)
            raise HTTPException(502, f"Cloudflare FLUX returned an unusable image response: {safe_detail}") from exc
        generation_time_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info("Cloudflare FLUX edit complete input=%sx%s output=%sx%s generation_time_ms=%s neurons=%s", input_width, input_height, width, height, generation_time_ms, neuron_usage)
        return ImageEditResult(generated, result_content_type, width, height, generation_time_ms, self.provider_name, neuron_usage)


def create_image_editing_provider(settings: Settings) -> ImageEditingProvider:
    provider = settings.image_provider.strip().lower()
    if provider == "gemini":
        return GeminiProvider(settings.gemini_api_key, settings.gemini_image_model, settings.fal_download_timeout_seconds)
    if provider == "cloudflare-flux":
        return CloudflareFluxProvider(settings.cloudflare_account_id, settings.cloudflare_ai_token, settings.cloudflare_image_model, settings.fal_download_timeout_seconds)
    if provider == "qwen-fal":
        return FalQwenProvider(settings.fal_key, settings.fal_qwen_model, settings.fal_download_timeout_seconds)
    raise HTTPException(500, f"Unsupported IMAGE_PROVIDER: {settings.image_provider}. Use cloudflare-flux, gemini, or qwen-fal.")
