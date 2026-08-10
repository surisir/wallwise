from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_origins: str = "http://localhost:3000"
    # Better boundary quality than the B0 model, at the cost of slower CPU inference.
    segmentation_model: str = "nvidia/segformer-b5-finetuned-ade-640-640"
    yolo_model: str = "yolo11n.pt"
    minimum_wall_area: int = 2000
    wall_confidence_threshold: float = 0.35
    enable_object_detection: bool = True
    image_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_image_model: str = "gemini-3.1-flash-image"
    cloudflare_account_id: str | None = None
    cloudflare_ai_token: str | None = None
    cloudflare_image_model: str = "@cf/black-forest-labs/flux-2-klein-4b"
    fal_key: str | None = None
    fal_qwen_model: str = "fal-ai/qwen-image-edit-2511"
    fal_download_timeout_seconds: int = 90

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
