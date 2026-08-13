from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

# Register once so Pillow can decode HEIC/HEIF input bytes without relying on
# filename extensions or browser-provided MIME types.
register_heif_opener()

logger = logging.getLogger(__name__)
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "HEIF", "HEIC"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream", None}
MAX_DECODED_PIXELS = 100_000_000
ANALYSIS_MAX_DIMENSION = 1280


@dataclass(frozen=True)
class ValidatedImage:
    # Normalized, EXIF-oriented JPEG used by the provider; raw HEIC never
    # reaches SegFormer, YOLO, or an image-editing provider.
    contents: bytes
    image: Image.Image
    filename: str
    supplied_mime_type: str | None
    detected_format: str
    byte_size: int
    original_width: int
    original_height: int


class ImageValidationService:
    def __init__(self, max_upload_bytes: int) -> None:
        self.max_upload_bytes = max_upload_bytes

    async def load(self, upload: UploadFile) -> Image.Image:
        return (await self.read(upload)).image

    @staticmethod
    def _analysis_copy(image: Image.Image) -> Image.Image:
        analysis = image.copy()
        analysis.thumbnail((ANALYSIS_MAX_DIMENSION, ANALYSIS_MAX_DIMENSION), Image.Resampling.LANCZOS)
        return analysis

    @staticmethod
    def _normalized_jpeg(image: Image.Image) -> bytes:
        normalized = BytesIO()
        image.save(normalized, format="JPEG", quality=95, optimize=True)
        return normalized.getvalue()

    async def read(self, upload: UploadFile) -> ValidatedImage:
        filename = upload.filename or "unnamed-upload"
        supplied_mime_type = upload.content_type
        logger.warning("mobile_upload stage=received filename=%s mime_type=%s", filename, supplied_mime_type)
        if supplied_mime_type not in ALLOWED_MIME_TYPES:
            # Browser metadata is advisory. In particular, Safari can label a
            # valid HEIC camera photo with a vendor-specific or empty MIME type.
            # Validate the actual bytes below, after pillow-heif has registered.
            logger.warning("mobile_upload stage=mime_metadata_unrecognized filename=%s mime_type=%s action=attempt_decode", filename, supplied_mime_type)

        contents = await upload.read(self.max_upload_bytes + 1)
        byte_size = len(contents)
        logger.warning("mobile_upload stage=read filename=%s byte_size=%s", filename, byte_size)
        if byte_size > self.max_upload_bytes:
            logger.warning("mobile_upload stage=size_validation status=413 filename=%s byte_size=%s", filename, byte_size)
            raise HTTPException(413, "Image exceeds the 10 MB upload limit.")
        try:
            with Image.open(BytesIO(contents)) as source:
                detected_format = source.format or "UNKNOWN"
                if detected_format not in ALLOWED_FORMATS:
                    logger.warning(
                        "mobile_upload stage=format_validation status=415 filename=%s supplied_mime=%s detected_format=%s",
                        filename,
                        supplied_mime_type,
                        detected_format,
                    )
                    raise HTTPException(415, "Unsupported image format. Use JPEG, PNG, WEBP, HEIC, or HEIF.")
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.load()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            is_heif_upload = supplied_mime_type in {"image/heic", "image/heif"} or filename.lower().endswith((".heic", ".heif"))
            status = 400 if is_heif_upload else 415
            detail = "We couldn't read this iPhone photo. Please try another image." if is_heif_upload else "Unsupported image format. Use JPEG, PNG, WEBP, HEIC, or HEIF."
            logger.warning("mobile_upload stage=decode status=%s filename=%s mime_type=%s error=%s", status, filename, supplied_mime_type, type(exc).__name__)
            raise HTTPException(status, detail) from exc

        original_width, original_height = image.size
        if original_width * original_height > MAX_DECODED_PIXELS:
            logger.warning("mobile_upload stage=dimension_validation status=413 filename=%s decoded_size=%sx%s", filename, original_width, original_height)
            raise HTTPException(413, "Image dimensions are too large to process safely.")
        analysis_image = self._analysis_copy(image)
        normalized_contents = self._normalized_jpeg(image)
        logger.warning(
            "mobile_upload stage=normalized filename=%s supplied_mime=%s byte_size=%s detected_format=%s decoded_size=%sx%s analysis_size=%sx%s",
            filename, supplied_mime_type, byte_size, detected_format, original_width, original_height, analysis_image.width, analysis_image.height,
        )
        return ValidatedImage(normalized_contents, analysis_image, filename, supplied_mime_type, detected_format, byte_size, original_width, original_height)
