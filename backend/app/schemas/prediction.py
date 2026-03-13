"""
Prediction Schemas — Olive Irrigation Forecasting & Anomaly Detection
"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

# Valid columns for forecasting
FORECASTABLE_COLUMNS = [
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
    "light_intensity_lux", "reservoir_level_pct", "main_pressure_mpa",
    "zone_flow_lpm", "zone_pressure_mpa", "soil_moisture_pct",
    "solar_radiation_wm2", "precipitation_mm", "wind_speed_kmh",
    "cloud_cover_pct", "stress_score", "health_score",
]


class ForecastRequest(BaseModel):
    """Request a time-series forecast for a specific column"""
    target_column: str = Field(..., description="Column to forecast (e.g. soil_moisture_pct)")
    zone_id: Optional[int] = Field(None, description="Zone to forecast (None = aggregate)")
    lookback_hours: int = Field(72, ge=6, le=720, description="Historical data to use")
    forecast_hours: int = Field(24, ge=1, le=168, description="Hours to predict ahead")


class ForecastPoint(BaseModel):
    """A single forecast point"""
    timestamp: str
    predicted_value: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    """Forecast result"""
    target_column: str
    zone_id: Optional[int]
    model: str
    accuracy_r2: Optional[float]
    trend_direction: str          # rising, falling, stable
    trend_slope_per_hour: float
    current_value: Optional[float]
    forecast: List[ForecastPoint]
    recommendations: List[str]


class AnomalyRequest(BaseModel):
    """Request anomaly detection on recent data"""
    target_column: str = Field(..., description="Column to check")
    zone_id: Optional[int] = None
    lookback_hours: int = Field(48, ge=6, le=720)
    z_threshold: float = Field(2.5, ge=1.5, le=5.0, description="Z-score threshold")


class AnomalyPoint(BaseModel):
    """A detected anomaly"""
    timestamp: str
    value: float
    z_score: float
    expected_range: dict   # {"min": ..., "max": ...}


class AnomalyResponse(BaseModel):
    """Anomaly detection result"""
    target_column: str
    zone_id: Optional[int]
    total_checked: int
    anomalies_found: int
    anomaly_rate_pct: float
    z_threshold: float
    anomalies: List[AnomalyPoint]
    recommendations: List[str]


class PredictionHistoryItem(BaseModel):
    id: str
    prediction_type: str
    target_column: str
    zone_id: Optional[int]
    model_used: str
    accuracy_score: Optional[float]
    result: dict
    created_at: datetime
