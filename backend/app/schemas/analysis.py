from pydantic import BaseModel, Field


class ImageSize(BaseModel):
    width: int
    height: int


class BoundingBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class DetectedObject(BaseModel):
    id: str
    label: str
    confidence: float = Field(ge=0, le=1)
    box: BoundingBox


class WallRegion(BaseModel):
    id: str
    confidence: float = Field(ge=0, le=1)
    mask: str
    boundingBox: BoundingBox
    area: int


class Surface(BaseModel):
    label: str
    mask: str


class AnalysisResponse(BaseModel):
    image: ImageSize
    objects: list[DetectedObject]
    walls: list[WallRegion]
    surfaces: list[Surface]
