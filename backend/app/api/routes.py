import asyncio
import json
import logging
import re
import time

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from app.core.config import Settings, get_settings
from app.schemas.analysis import AnalysisResponse, ImageSize
from app.services.image_validation import ImageValidationService
from app.services.object_detection import ObjectDetectionService
from app.services.segmentation import RoomSegmentationService
from app.services.wall_regions import WallRegionService
from app.services.wall_color_edit import (
    SelectedColor,
    create_image_editing_provider,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_settings = get_settings()

# These adapters live for the application process.
# Their models are loaded lazily on the first analysis request and then reused.
_segmentation = RoomSegmentationService(_settings.segmentation_model)
_objects = ObjectDetectionService(
    _settings.yolo_model,
    _settings.enable_object_detection,
)


def _lighting_instruction(value: int | None, label: str | None) -> str:
    if value is None:
        return ""
    if value <= 20:
        mode = "night / artificial light"
        detail = (
            "Show the selected paint color under believable night or artificial lighting. "
            "The walls should read darker and less sunlit, with realistic warm/cool fixture "
            "illumination where appropriate."
        )
    elif value <= 40:
        mode = "evening warm light"
        detail = (
            "Show the selected paint color under warm evening or golden-hour light. "
            "Use gentle warmth and lower light intensity while preserving natural shadows."
        )
    elif value <= 60:
        mode = "same natural lighting as the original photo"
        detail = (
            "Preserve the original photograph's lighting as closely as possible. "
            "Do not introduce a new time of day or artificial lighting change."
        )
    elif value <= 80:
        mode = "bright daylight"
        detail = (
            "Show the selected paint color under bright daylight. Keep realistic highlights, "
            "shadow direction, and texture without washing out the paint color."
        )
    else:
        mode = "strong direct sunlight"
        detail = (
            "Show the selected paint color under strong direct sunlight. Preserve believable "
            "sunlit highlights, harder shadows, wall texture, and the same architecture."
        )
    safe_label = label.strip() if label else mode
    return (
        f" Lighting slider guidance: value {value}/100, requested appearance: "
        f"{safe_label}. {detail} This is a lighting visualization only; do not "
        "change room/building geometry, camera angle, objects, wall selection, "
        "paint color identity, or composition."
    )


def _parse_guidance_points(raw: str | None, field_name: str) -> list[dict]:
    if not raw:
        return []
    try:
        points = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be a JSON array.",
        ) from exc

    def valid_number(value) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool)

    if not isinstance(points, list):
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be a JSON array.",
        )

    normalized = []
    for point in points:
        if (
            not isinstance(point, dict)
            or not isinstance(point.get("id"), str)
            or not point.get("id")
            or not isinstance(point.get("x"), int)
            or isinstance(point.get("x"), bool)
            or not isinstance(point.get("y"), int)
            or isinstance(point.get("y"), bool)
        ):
            raise HTTPException(
                status_code=422,
                detail=f"{field_name} must be a JSON array of {{id, x, y}}.",
            )
        x_percent = point.get("xPercent")
        y_percent = point.get("yPercent")
        if (
            (x_percent is not None and not valid_number(x_percent))
            or (y_percent is not None and not valid_number(y_percent))
        ):
            raise HTTPException(
                status_code=422,
                detail=f"{field_name} percentages must be numbers.",
            )
        normalized.append(point)
    return normalized


def _format_guidance_points(points: list[dict]) -> str:
    formatted = []
    for point in points:
        percent_hint = ""
        if point.get("xPercent") is not None and point.get("yPercent") is not None:
            percent_hint = (
                f", approximately {point['xPercent']}% from the left and "
                f"{point['yPercent']}% from the top"
            )
        formatted.append(
            f"{point['id']} at image coordinate ({point['x']}, {point['y']})"
            f"{percent_hint}"
        )
    return "; ".join(formatted)


def _fallback_room_masks(image) -> tuple[dict[str, np.ndarray], float]:
    """Return a conservative editable wall estimate when CPU segmentation times out.

    This path is deliberately lightweight. It samples side-wall pixels in the
    expected wall band and keeps pixels with similar color/luminance, so the
    instant preview does not paint a giant rectangle over foreground objects.
    AI visualization still receives the original image and remains provider-led.
    """
    width, height = image.size
    wall = np.zeros((height, width), dtype=bool)
    ceiling = np.zeros_like(wall)
    floor = np.zeros_like(wall)
    empty = np.zeros_like(wall)

    ceiling_bottom = max(1, int(height * 0.12))
    floor_top = min(height, int(height * 0.74))
    ceiling[:ceiling_bottom, :] = True
    floor[floor_top:, :] = True

    pixels = np.asarray(image.convert("RGB"), dtype=np.int16)
    candidate_band = np.zeros_like(wall)
    candidate_band[ceiling_bottom:floor_top, :] = True

    # Walls are usually visible near one or both side edges. Sampling there
    # avoids foreground-heavy centers such as cabinets, beds, racks, and boxes.
    strip_width = max(8, int(width * 0.08))
    side_samples = np.concatenate(
        [
            pixels[ceiling_bottom:floor_top, :strip_width].reshape(-1, 3),
            pixels[ceiling_bottom:floor_top, width - strip_width :].reshape(-1, 3),
        ],
        axis=0,
    )
    if side_samples.size:
        luminance_samples = (
            0.2126 * side_samples[:, 0]
            + 0.7152 * side_samples[:, 1]
            + 0.0722 * side_samples[:, 2]
        )
        low, high = np.percentile(luminance_samples, [20, 95])
        likely_wall_samples = side_samples[
            (luminance_samples >= low)
            & (luminance_samples <= high)
        ]
        reference = np.median(
            likely_wall_samples if len(likely_wall_samples) else side_samples,
            axis=0,
        )
        diff = np.linalg.norm(pixels - reference, axis=2)
        luminance = (
            0.2126 * pixels[:, :, 0]
            + 0.7152 * pixels[:, :, 1]
            + 0.0722 * pixels[:, :, 2]
        )
        chroma = pixels.max(axis=2) - pixels.min(axis=2)
        wall = (
            candidate_band
            & (diff < 62)
            & (luminance > 95)
            & (chroma < 80)
        )

    if float(wall.mean()) < 0.03:
        # If the heuristic cannot find enough wall, return no painted mask
        # instead of a misleading rectangle. The user can still use AI
        # visualization, which is the reliable path for hard images.
        wall[:] = False

    return {
        "wall": wall,
        "floor": floor,
        "ceiling": ceiling,
        "window": empty.copy(),
        "door": empty.copy(),
    }, 0.35


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/diagnostics")
def diagnostics(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    return {
        "status": "ok",
        "segmentation_model": settings.segmentation_model,
        "enable_object_detection": settings.enable_object_detection,
        "max_upload_bytes": settings.max_upload_bytes,
        "analysis_timeout_seconds": settings.analysis_timeout_seconds,
        "image_provider": settings.image_provider,
    }


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    image: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
) -> AnalysisResponse:

    # ---------------------------------------------------------
    # 1. Validate and read uploaded image
    # ---------------------------------------------------------
    try:
        logger.warning(
            "ANALYZE: starting upload validation filename=%s",
            image.filename,
        )

        upload_start = time.perf_counter()

        uploaded = await ImageValidationService(
            settings.max_upload_bytes
        ).read(image)

        upload_seconds = time.perf_counter() - upload_start

        logger.warning(
            "ANALYZE: upload validation complete "
            "filename=%s format=%s size=%sx%s time=%.2fs",
            uploaded.filename,
            uploaded.detected_format,
            uploaded.image.width,
            uploaded.image.height,
            upload_seconds,
        )

    except HTTPException as exc:
        logger.warning(
            "mobile_upload stage=validation_complete "
            "status=%s detail=%s",
            exc.status_code,
            exc.detail,
        )
        raise

    except Exception as exc:
        logger.exception(
            "ANALYZE: unexpected upload validation error=%s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=400,
            detail="Unable to process the uploaded image.",
        ) from exc

    # ---------------------------------------------------------
    # 2. AI segmentation
    # ---------------------------------------------------------
    try:
        logger.warning(
            "ANALYZE: starting segmentation model=%s",
            settings.segmentation_model,
        )

        segmentation_start = time.perf_counter()

        masks, confidence = await asyncio.wait_for(
            asyncio.to_thread(_segmentation.segment, uploaded.image),
            timeout=settings.analysis_timeout_seconds,
        )

        segmentation_seconds = time.perf_counter() - segmentation_start

        logger.warning(
            "ANALYZE: segmentation complete "
            "time=%.2fs confidence=%.4f",
            segmentation_seconds,
            confidence,
        )

        # RoomSegmentationService stores useful diagnostics here.
        if getattr(_segmentation, "last_debug", None):
            logger.warning(
                "ANALYZE: segmentation debug=%s",
                _segmentation.last_debug,
            )

    except asyncio.TimeoutError:
        logger.warning(
            "ANALYZE: segmentation timeout "
            "timeout=%ss filename=%s analysis_size=%sx%s action=fallback",
            settings.analysis_timeout_seconds,
            uploaded.filename,
            uploaded.image.width,
            uploaded.image.height,
        )
        masks, confidence = _fallback_room_masks(uploaded.image)

    except Exception as exc:
        logger.exception(
            "mobile_upload stage=segmentation "
            "status=503 error=%s",
            type(exc).__name__,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "AI analysis is temporarily unavailable. "
                "Check model downloads and server resources."
            ),
        ) from exc

    # ---------------------------------------------------------
    # 3. Object detection
    #
    # Object detection is intentionally non-fatal. If YOLO fails,
    # wall/surface analysis can still be returned.
    # ---------------------------------------------------------
    try:
        if settings.enable_object_detection:
            logger.warning(
                "ANALYZE: starting object detection model=%s",
                settings.yolo_model,
            )

            object_start = time.perf_counter()

            objects = _objects.detect(uploaded.image)

            object_seconds = time.perf_counter() - object_start

            logger.warning(
                "ANALYZE: object detection complete "
                "objects=%s time=%.2fs",
                len(objects),
                object_seconds,
            )
        else:
            logger.warning(
                "ANALYZE: object detection disabled"
            )
            objects = []

    except Exception as exc:
        logger.warning(
            "mobile_upload stage=object_detection_nonfatal "
            "error=%s",
            type(exc).__name__,
            exc_info=True,
        )
        objects = []

    # ---------------------------------------------------------
    # 4. Extract wall and surface regions
    # ---------------------------------------------------------
    try:
        wall_service = WallRegionService(
            settings.minimum_wall_area,
            settings.wall_confidence_threshold,
        )

        logger.warning(
            "ANALYZE: extracting wall regions"
        )

        walls = wall_service.extract_walls(
            masks["wall"],
            confidence,
        )

        surfaces = wall_service.surfaces(
            {
                key: masks[key]
                for key in (
                    "floor",
                    "ceiling",
                    "window",
                    "door",
                )
            }
        )

        logger.warning(
            "ANALYZE: wall/surface extraction complete "
            "walls=%s surfaces=%s",
            len(walls),
            len(surfaces),
        )

    except Exception as exc:
        logger.exception(
            "ANALYZE: wall region extraction failed "
            "error=%s",
            type(exc).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to extract wall regions from the analysis.",
        ) from exc

    # ---------------------------------------------------------
    # 5. Return analysis
    # ---------------------------------------------------------
    logger.warning(
        "mobile_upload stage=analysis_complete "
        "status=200 filename=%s detected_format=%s",
        uploaded.filename,
        uploaded.detected_format,
    )

    return AnalysisResponse(
        image=ImageSize(
            width=uploaded.image.width,
            height=uploaded.image.height,
        ),
        objects=objects,
        walls=walls,
        surfaces=surfaces,
    )


@router.post("/visualize")
async def visualize_wall_color(
    image: UploadFile = File(...),
    color_hex: str = Form(...),
    color_name: str | None = Form(None),
    color_rgb: str | None = Form(None),
    ai_only: bool = Form(False),
    selected_area_ids: str | None = Form(None),
    target_points: str | None = Form(None),
    excluded_points: str | None = Form(None),
    project_type: str | None = Form(None),
    lighting_value: int | None = Form(None),
    lighting_label: str | None = Form(None),
    settings: Settings = Depends(get_settings),
) -> Response:

    # ---------------------------------------------------------
    # 1. Validate HEX color
    # ---------------------------------------------------------
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color_hex):
        raise HTTPException(
            status_code=422,
            detail="Choose a valid six-digit HEX color.",
        )

    expected_rgb = ",".join(
        str(int(color_hex[index:index + 2], 16))
        for index in (1, 3, 5)
    )

    if color_rgb and color_rgb.replace(" ", "") != expected_rgb:
        raise HTTPException(
            status_code=422,
            detail="The supplied RGB value does not match the selected HEX color.",
        )

    if lighting_value is not None and not 0 <= lighting_value <= 100:
        raise HTTPException(
            status_code=422,
            detail="Lighting value must be between 0 and 100.",
        )

    if project_type and project_type not in {"interior", "exterior"}:
        raise HTTPException(
            status_code=422,
            detail="Project type must be interior or exterior.",
        )

    # ---------------------------------------------------------
    # 2. Parse selected areas
    # ---------------------------------------------------------
    try:
        selected_areas = (
            json.loads(selected_area_ids)
            if selected_area_ids
            else []
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="Selected areas must be a JSON array.",
        ) from exc

    if (
        not isinstance(selected_areas, list)
        or not all(
            isinstance(area_id, str) and area_id
            for area_id in selected_areas
        )
    ):
        raise HTTPException(
            status_code=422,
            detail="Selected areas must be a JSON array of IDs.",
        )

    selected_points = _parse_guidance_points(target_points, "Target points")
    deselected_points = _parse_guidance_points(excluded_points, "Excluded points")

    # ---------------------------------------------------------
    # 3. Validate uploaded image
    # ---------------------------------------------------------
    validated = await ImageValidationService(
        settings.max_upload_bytes
    ).read(image)

    # ---------------------------------------------------------
    # 4. Create image editing provider
    # ---------------------------------------------------------
    provider = create_image_editing_provider(settings)

    # ---------------------------------------------------------
    # 5. Build editing instructions
    # ---------------------------------------------------------
    if ai_only:
        edit_instruction = (
            "All visible paintable wall surfaces are selected. "
            "Identify the paintable wall surfaces yourself and repaint "
            "only those surfaces while preserving openings, landscaping, "
            "trim, roof, pavement and all objects."
        )
        if project_type == "exterior":
            edit_instruction = (
                f"{edit_instruction} For exterior photos, repaint only the "
                "main property's paintable exterior walls/facade surfaces. "
                "Do not repaint neighboring buildings, adjacent houses, sky, "
                "trees, plants, roof, signage, pavement, driveway, road, "
                "windows, doors, gates, railings, trim or decorative panels."
            )
    elif selected_areas and selected_points:
        point_summary = _format_guidance_points(selected_points)
        excluded_summary = _format_guidance_points(deselected_points)
        edit_instruction = (
            "This is a targeted repaint, not a full-facade repaint. "
            "Repaint ONLY the selected wall plane(s) containing these target "
            f"points: {point_summary}. Do not repaint any other wall plane "
            "or facade area. Treat these coordinates as natural-image "
            "guidance for which exact surfaces to repaint; do not draw or "
            "leave any markers in the final image. "
        )
        if deselected_points:
            edit_instruction = (
                f"{edit_instruction} The following deselected/unselected wall "
                "or facade targets must remain their original color and must "
                f"not be repainted: {excluded_summary}. "
            )
        edit_instruction = (
            f"{edit_instruction} If the selected target is ambiguous, repaint "
            "less rather than more: keep the repaint local to the selected "
            "wall plane and leave adjacent or surrounding surfaces unchanged."
        )
        if project_type == "exterior":
            edit_instruction = (
                f"{edit_instruction} For exterior photos, do not repaint "
                "neighboring buildings, adjacent houses, left/right side "
                "facades, boundary walls, roof, signage, pavement, driveway, "
                "road, landscaping, trees, plants, windows, doors, gates, "
                "railings, columns, trim or decorative panels unless those "
                "exact surfaces are selected."
            )
    elif selected_areas:
        edit_instruction = (
            "Repaint only the user-selected wall areas: "
            f"{', '.join(selected_areas)}. Leave unselected walls unchanged."
        )
    else:
        edit_instruction = (
            "All visible paintable wall surfaces are selected. Repaint all "
            "paintable walls and preserve everything else."
        )

    lighting_instruction = _lighting_instruction(lighting_value, lighting_label)
    if lighting_instruction:
        edit_instruction = f"{edit_instruction}{lighting_instruction}"

    selected_color = SelectedColor(
        color_hex.upper(),
        color_name,
        edit_instruction,
    )

    # ---------------------------------------------------------
    # 6. Generate edited image
    # ---------------------------------------------------------
    result = await asyncio.to_thread(
        provider.edit_wall_color,
        validated.contents,
        "room-image.jpg",
        "image/jpeg",
        selected_color,
    )

    # ---------------------------------------------------------
    # 7. Return generated image
    # ---------------------------------------------------------
    return Response(
        content=result.image,
        media_type=result.content_type,
        headers={
            "Cache-Control": "no-store",
            "X-Image-Provider": result.provider,
            "X-Generation-Time-Ms": str(result.generation_time_ms),
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
            "X-Cloudflare-Neuron-Usage": (
                ""
                if result.neuron_usage is None
                else str(result.neuron_usage)
            ),
        },
    )
