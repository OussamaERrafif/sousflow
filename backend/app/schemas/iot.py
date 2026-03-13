"""
IoT Schemas — Olive Irrigation IoT Data Model
26-column dataset: environmental, water infrastructure, zone water,
zone soil, weather context, and derived metrics.
"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ─── Column groups ──────────────────────────────────────────────

class EnvironmentalData(BaseModel):
    """BME280, DHT11, BH1750 — shared across all zones"""
    air_temperature_c: Optional[float] = Field(None, description="°C (BME280)")
    air_humidity_pct: Optional[float] = Field(None, description="% RH (BME280/DHT11)")
    air_pressure_hpa: Optional[float] = Field(None, description="hPa (BME280)")
    light_intensity_lux: Optional[float] = Field(None, description="lux (BH1750)")


class WaterInfrastructureData(BaseModel):
    """HC-SR04, pressure sensor, filter — shared"""
    reservoir_level_pct: Optional[float] = Field(None, description="% tank fill (HC-SR04)")
    main_pressure_mpa: Optional[float] = Field(None, description="MPa after filter")
    filter_status: Optional[int] = Field(None, description="0=clean 1=partial 2=clogged")


class ZoneWaterData(BaseModel):
    """YF-S201 flow, zone pressure, solenoid — per-zone"""
    valve_open: Optional[int] = Field(None, description="0=closed 1=open")
    zone_flow_lpm: Optional[float] = Field(None, description="L/min (YF-S201)")
    zone_pressure_mpa: Optional[float] = Field(None, description="MPa (zone inlet)")


class ZoneSoilData(BaseModel):
    """Capacitive soil moisture — per-zone"""
    soil_moisture_pct: Optional[float] = Field(None, description="% volumetric")


class WeatherContextData(BaseModel):
    """Open-Meteo Archive API — shared"""
    solar_radiation_wm2: Optional[float] = Field(None, description="W/m² shortwave")
    precipitation_mm: Optional[float] = Field(None, description="mm hourly rainfall")
    wind_speed_kmh: Optional[float] = Field(None, description="km/h at 10m")
    cloud_cover_pct: Optional[float] = Field(None, description="% cloud cover")


class DerivedMetrics(BaseModel):
    """Computed/simulated metrics"""
    is_anomaly: Optional[int] = Field(0, description="0/1 sensor fault flag")
    stress_score: Optional[float] = Field(None, description="0.0-1.0 plant stress")
    stress_class: Optional[str] = Field(None, description="none/mild/moderate/severe")
    health_score: Optional[float] = Field(None, description="0.0-10.0 plant health")
    irrigation_needed: Optional[int] = Field(0, description="0/1 irrigate decision")


# ─── Full reading (ingest) ──────────────────────────────────────

class IoTReadingCreate(BaseModel):
    """Single IoT reading — matches the 26-column CSV schema"""
    timestamp: datetime
    month: Optional[int] = None
    hour: Optional[int] = None
    zone_id: int = Field(..., ge=1, le=20, description="Irrigation zone (1-based)")
    plant_type: str = "olive"
    plant_species: str = "Olea europaea"

    # Environmental (shared)
    air_temperature_c: Optional[float] = None
    air_humidity_pct: Optional[float] = None
    air_pressure_hpa: Optional[float] = None
    light_intensity_lux: Optional[float] = None

    # Water infrastructure (shared)
    reservoir_level_pct: Optional[float] = None
    main_pressure_mpa: Optional[float] = None
    filter_status: Optional[int] = Field(None, ge=0, le=2)

    # Zone water (per-zone)
    valve_open: Optional[int] = Field(None, ge=0, le=1)
    zone_flow_lpm: Optional[float] = None
    zone_pressure_mpa: Optional[float] = None

    # Zone soil (per-zone)
    soil_moisture_pct: Optional[float] = None

    # Weather (shared)
    solar_radiation_wm2: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    cloud_cover_pct: Optional[float] = None

    # Derived
    is_anomaly: Optional[int] = Field(0, ge=0, le=1)
    stress_score: Optional[float] = None
    stress_class: Optional[str] = None
    health_score: Optional[float] = None
    irrigation_needed: Optional[int] = Field(0, ge=0, le=1)


class IoTReadingResponse(IoTReadingCreate):
    """IoT reading + DB fields"""
    id: str
    user_id: str
    created_at: datetime


class IoTBatchCreate(BaseModel):
    """Batch of IoT readings (up to 1000 per request)"""
    readings: List[IoTReadingCreate] = Field(..., max_length=1000)


class IoTBatchResponse(BaseModel):
    """Response for batch ingest"""
    inserted: int
    failed: int
    errors: List[str] = []


# ─── Query ──────────────────────────────────────────────────────

class IoTQueryParams(BaseModel):
    """Query filters for IoT readings"""
    zone_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    columns: Optional[List[str]] = Field(None, description="Select specific columns")
    anomalies_only: bool = False
    irrigation_only: bool = False
    limit: int = Field(100, ge=1, le=5000)
    offset: int = Field(0, ge=0)


# ─── Analysis / Aggregation ─────────────────────────────────────

class ZoneSummary(BaseModel):
    """Per-zone statistical summary"""
    zone_id: int
    total_readings: int
    soil_moisture: dict  # min, avg, max
    zone_flow: dict
    zone_pressure: dict
    stress_score_avg: float
    health_score_avg: float
    valve_open_count: int
    valve_open_pct: float
    irrigation_needed_count: int
    stress_class_distribution: dict


class SensorStats(BaseModel):
    """Summary statistics for a numeric column"""
    column: str
    unit: str
    min: float
    p25: float
    median: float
    mean: float
    p75: float
    p95: float
    max: float
    std: float


class DashboardSnapshot(BaseModel):
    """Dashboard summary data"""
    total_readings: int
    date_range: dict
    zones: List[ZoneSummary]
    anomaly_count: int
    anomaly_rate_pct: float
    avg_health_score: float
    avg_stress_score: float
    reservoir_level_pct: Optional[float]
    filter_status: Optional[int]
    last_reading_at: Optional[datetime]


class MonthlyProfile(BaseModel):
    """Monthly aggregate profile"""
    month: int
    readings: int
    avg_temperature_c: float
    avg_humidity_pct: float
    avg_light_lux: float
    avg_soil_moisture_pct: float
    avg_stress_score: float
    avg_health_score: float
    total_precipitation_mm: float
    valve_open_pct: float


# ─── Alert Rules ────────────────────────────────────────────────

ConditionType = Literal["above", "below", "equals"]

ALERTABLE_COLUMNS = [
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
    "light_intensity_lux", "reservoir_level_pct", "main_pressure_mpa",
    "soil_moisture_pct", "zone_flow_lpm", "zone_pressure_mpa",
    "stress_score", "health_score",
    "solar_radiation_wm2", "wind_speed_kmh", "precipitation_mm",
]


class AlertRuleCreate(BaseModel):
    """Create an alert rule"""
    name: str
    target_column: str = Field(..., description="Column to monitor")
    condition: ConditionType = "above"
    threshold: float
    zone_id: Optional[int] = Field(None, description="NULL = all zones")
    notify_whatsapp: bool = True
    phone: Optional[str] = None
    message_template: Optional[str] = None


class AlertRuleResponse(AlertRuleCreate):
    id: str
    user_id: str
    is_active: bool
    created_at: datetime
