"""
Centralized configuration using pydantic-settings
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    APP_NAME: str = "SoussFlow Backend"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Wassender (WhatsApp)
    WASSENDER_ENABLED: bool = False
    WASSENDER_API_URL: str = "https://api.wassenger.com/v1"
    WASSENDER_API_KEY: str = ""
    WASSENDER_DEVICE_ID: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # IoT
    IOT_DATA_RETENTION_DAYS: int = 90

    # IoT Simulator
    IOT_SIMULATOR_ENABLED: bool = False
    IOT_SIMULATOR_ZONES: int = 4
    IOT_SIMULATOR_INTERVAL: float = 5.0
    IOT_SIMULATOR_USER_ID: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
