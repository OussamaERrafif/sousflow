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
    DEBUG_MODE: bool = False  # Debug mode for detailed logging
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Supabase (used as database only, not for auth)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # JWT (self-managed auth)
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 480  # 8 hours

    # WaSenderAPI (WhatsApp)
    WASSENDER_ENABLED: bool = False
    WASSENDER_API_URL: str = "https://www.wasenderapi.com"
    WASSENDER_API_KEY: str = ""
    WASSENDER_DEVICE_ID: str = ""
    WASSENDER_WEBHOOK_SECRET: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # IoT
    IOT_DATA_RETENTION_DAYS: int = 90
    ML_ANOMALY_ENABLED: bool = False

    # IoT Simulator
    IOT_SIMULATOR_ENABLED: bool = False
    IOT_SIMULATOR_ZONES: int = 4
    IOT_SIMULATOR_BRANCHES_PER_ZONE: int = 3
    IOT_SIMULATOR_INTERVAL: float = 300.0
    IOT_SIMULATOR_LEAK_PROBABILITY: float = 0.02
    IOT_SIMULATOR_FARM_ID: Optional[str] = None
    IOT_SIMULATOR_USER_ID: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
