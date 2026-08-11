import asyncio
import json
import logging
import re
import time

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


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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

        masks, confidence = _segmentation.segment(uploaded.image)

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
            "Identify visible paintable wall or facade surfaces "
            "yourself. Repaint only those surfaces while preserving "
            "openings, landscaping, trim, roof, pavement and all objects."
        )
    elif selected_areas:
        edit_instruction = (
            "Apply the requested paint color together across the "
            "user-selected paintable areas: "
            f"{', '.join(selected_areas)}."
        )
    else:
        edit_instruction = None

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