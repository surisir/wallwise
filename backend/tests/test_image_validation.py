import asyncio
from io import BytesIO

from fastapi import UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.services.image_validation import ImageValidationService


def upload(data: bytes, filename: str, mime_type: str) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(data), headers=Headers({"content-type": mime_type}))


def encoded_image(format: str, size: tuple[int, int] = (80, 60), orientation: int | None = None) -> bytes:
    image = Image.new("RGB", size, "white")
    data = BytesIO()
    if orientation:
        exif = Image.Exif()
        exif[274] = orientation
        image.save(data, format=format, exif=exif)
    else:
        image.save(data, format=format)
    return data.getvalue()


def test_desktop_jpeg_and_octet_stream_mobile_jpeg_normalize_identically() -> None:
    service = ImageValidationService(10 * 1024 * 1024)
    data = encoded_image("JPEG")
    desktop = asyncio.run(service.read(upload(data, "room.jpg", "image/jpeg")))
    mobile = asyncio.run(service.read(upload(data, "IMG_1234", "application/octet-stream")))
    assert desktop.detected_format == mobile.detected_format == "JPEG"
    assert desktop.image.size == mobile.image.size == (80, 60)
    assert desktop.contents.startswith(b"\xff\xd8")


def test_mobile_screenshot_png_is_supported() -> None:
    result = asyncio.run(ImageValidationService(10 * 1024 * 1024).read(upload(encoded_image("PNG"), "Screenshot.png", "image/png")))
    assert result.detected_format == "PNG"
    assert result.image.mode == "RGB"


def test_exif_orientation_is_applied_before_analysis() -> None:
    result = asyncio.run(ImageValidationService(10 * 1024 * 1024).read(upload(encoded_image("JPEG", (40, 80), orientation=6), "portrait.jpg", "image/jpeg")))
    assert (result.original_width, result.original_height) == (80, 40)


def test_large_24mp_camera_image_is_downscaled_only_for_analysis() -> None:
    result = asyncio.run(ImageValidationService(10 * 1024 * 1024).read(upload(encoded_image("JPEG", (6000, 4000)), "camera.jpg", "image/jpeg")))
    assert result.image.size == (1280, 853)
    assert (result.original_width, result.original_height) == (6000, 4000)


def test_heif_plugin_is_registered_with_pillow() -> None:
    assert ".heic" in Image.registered_extensions()
    assert ".heif" in Image.registered_extensions()


def test_heif_upload_decodes_and_normalizes_to_jpeg() -> None:
    heif = BytesIO()
    Image.new("RGB", (96, 144), "white").save(heif, format="HEIF")
    result = asyncio.run(ImageValidationService(10 * 1024 * 1024).read(upload(heif.getvalue(), "iphone.heif", "image/heif")))
    assert result.detected_format == "HEIF"
    assert result.contents.startswith(b"\xff\xd8")


def test_heic_filename_with_unexpected_safari_mime_decodes_by_content() -> None:
    heif = BytesIO()
    Image.new("RGB", (96, 144), "white").save(heif, format="HEIF")
    result = asyncio.run(
        ImageValidationService(10 * 1024 * 1024).read(
            upload(heif.getvalue(), "IMG_1234.HEIC", "application/x-ios-camera")
        )
    )
    assert result.detected_format == "HEIF"
    assert result.image.size == (96, 144)
