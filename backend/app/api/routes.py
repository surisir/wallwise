import asyncio
import json
import logging
import re
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from app.core.config import Settings, get_settings
from app.schemas.analysis import AnalysisResponse, ImageSize
from app.services.image_validation import ImageValidationService
from app.services.object_detection import ObjectDetectionService
from app.services.segmentation import RoomSegmentationService
from app.services.wall_regions import WallRegionService
from app.services.wall_color_edit import SelectedColor, create_image_editing_provider

router = APIRouter()
logger = logging.getLogger(__name__)
_settings = get_settings()
# These adapters live for the application process; their models are lazily loaded once,
# then reused for every analysis request.
_segmentation = RoomSegmentationService(_settings.segmentation_model)
_objects = ObjectDetectionService(_settings.yolo_model, _settings.enable_object_detection)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(image: UploadFile = File(...), settings: Settings = Depends(get_settings)) -> AnalysisResponse:
    try:
        uploaded = await ImageValidationService(settings.max_upload_bytes).read(image)
    except HTTPException as exc:
        logger.warning("mobile_upload stage=validation_complete status=%s detail=%s", exc.status_code, exc.detail)
        raise
    try:
        masks, confidence = _segmentation.segment(uploaded.image)
    except Exception as exc:
        logger.exception("mobile_upload stage=segmentation status=503 error=%s", type(exc).__name__)
        raise HTTPException(503, "AI analysis is temporarily unavailable. Check model downloads and try again.") from exc
    # Detection enriches the editor but should never prevent paint visualization.
    try:
        objects = _objects.detect(uploaded.image)
    except Exception as exc:
        logger.warning("mobile_upload stage=object_detection_nonfatal error=%s", type(exc).__name__)
        objects = []
    wall_service = WallRegionService(settings.minimum_wall_area, settings.wall_confidence_threshold)
    logger.warning("mobile_upload stage=analysis_complete status=200 filename=%s detected_format=%s", uploaded.filename, uploaded.detected_format)
    return AnalysisResponse(image=ImageSize(width=uploaded.image.width, height=uploaded.image.height), objects=objects, walls=wall_service.extract_walls(masks["wall"], confidence), surfaces=wall_service.surfaces({key: masks[key] for key in ("floor", "ceiling", "window", "door")}))


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
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color_hex):
        raise HTTPException(422, "Choose a valid six-digit HEX color.")
    expected_rgb = ",".join(str(int(color_hex[index:index + 2], 16)) for index in (1, 3, 5))
    if color_rgb and color_rgb.replace(" ", "") != expected_rgb:
        raise HTTPException(422, "The supplied RGB value does not match the selected HEX color.")
    try:
        selected_areas = json.loads(selected_area_ids) if selected_area_ids else []
    except json.JSONDecodeError as exc:
        raise HTTPException(422, "Selected areas must be a JSON array.") from exc
    if not isinstance(selected_areas, list) or not all(isinstance(area_id, str) and area_id for area_id in selected_areas):
        raise HTTPException(422, "Selected areas must be a JSON array of IDs.")
    validated = await ImageValidationService(settings.max_upload_bytes).read(image)
    provider = create_image_editing_provider(settings)
    result = await asyncio.to_thread(
        provider.edit_wall_color,
        validated.contents,
        "room-image.jpg",
        "image/jpeg",
        SelectedColor(color_hex.upper(), color_name, (
            "Identify visible paintable wall or facade surfaces yourself. Repaint only those surfaces while preserving openings, landscaping, trim, roof, pavement and all objects."
            if ai_only else (f"Apply the requested paint color together across the user-selected paintable areas: {', '.join(selected_areas)}."
            if selected_areas else None)
        )),
    )
    return Response(
        content=result.image,
        media_type=result.content_type,
        headers={
            "Cache-Control": "no-store",
            "X-Image-Provider": result.provider,
            "X-Generation-Time-Ms": str(result.generation_time_ms),
            "X-Image-Width": str(result.width),
            "X-Image-Height": str(result.height),
            "X-Cloudflare-Neuron-Usage": "" if result.neuron_usage is None else str(result.neuron_usage),
        },
    )
