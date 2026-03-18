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


# ─── NEW v3 Hierarchical Models ──────────────────────────────────

# ── Ingest Models (what sensors send) ────────────────────────

class EnvironmentReadingCreate(BaseModel):
    """Weather station data — one per farm per cycle."""
    air_temperature_c: Optional[float] = None
    air_humidity_pct: Optional[float] = Field(None, ge=0, le=100)
    air_pressure_hpa: Optional[float] = None
    light_intensity_lux: Optional[float] = Field(None, ge=0)
    solar_radiation_wm2: Optional[float] = Field(None, ge=0)
    precipitation_mm: Optional[float] = Field(None, ge=0)
    wind_speed_kmh: Optional[float] = Field(None, ge=0)
    cloud_cover_pct: Optional[float] = Field(None, ge=0, le=100)


class InfrastructureReadingCreate(BaseModel):
    """Reservoir, main pump, filter — one per farm per cycle."""
    reservoir_level_pct: Optional[float] = Field(None, ge=0, le=100)
    main_pump_flow_lpm: Optional[float] = Field(None, ge=0)
    main_pressure_mpa: Optional[float] = Field(None, ge=0)
    filter_status: Optional[int] = Field(None, ge=0, le=2)


class BranchFlowReadingCreate(BaseModel):
    """Inlet + outlet flow meter data for one branch."""
    branch_id: str
    valve_open: Optional[int] = Field(None, ge=0, le=1)
    inlet_flow_lpm: Optional[float] = Field(None, ge=0)
    outlet_flow_lpm: Optional[float] = Field(None, ge=0)
    inlet_pressure_mpa: Optional[float] = Field(None, ge=0)
    outlet_pressure_mpa: Optional[float] = Field(None, ge=0)


class SoilMoistureReadingCreate(BaseModel):
    """3 soil moisture sensors along one branch."""
    branch_id: str
    moisture_start_pct: Optional[float] = Field(None, ge=0, le=100)
    moisture_middle_pct: Optional[float] = Field(None, ge=0, le=100)
    moisture_end_pct: Optional[float] = Field(None, ge=0, le=100)


class BranchCycleData(BaseModel):
    """All sensor data for one branch in one cycle."""
    branch_id: str
    flow: BranchFlowReadingCreate
    soil: SoilMoistureReadingCreate


class IoTCycleCreate(BaseModel):
    """One complete reading cycle for the entire farm.
    Contains shared environment/infra + per-branch flow and soil data."""
    timestamp: Optional[datetime] = None
    environment: EnvironmentReadingCreate
    infrastructure: InfrastructureReadingCreate
    branches: List[BranchCycleData]


# ── Response Models ──────────────────────────────────────────

class EnvironmentReadingResponse(EnvironmentReadingCreate):
    id: str
    farm_id: str
    timestamp: datetime
    created_at: datetime


class InfrastructureReadingResponse(InfrastructureReadingCreate):
    id: str
    farm_id: str
    timestamp: datetime
    created_at: datetime


class BranchFlowReadingResponse(BaseModel):
    id: str
    branch_id: str
    farm_id: str
    zone_id: str
    timestamp: datetime
    valve_open: Optional[int] = None
    inlet_flow_lpm: Optional[float] = None
    outlet_flow_lpm: Optional[float] = None
    inlet_pressure_mpa: Optional[float] = None
    outlet_pressure_mpa: Optional[float] = None
    flow_delta_lpm: Optional[float] = None
    leak_detected: bool = False
    created_at: datetime


class SoilMoistureReadingResponse(BaseModel):
    id: str
    branch_id: str
    farm_id: str
    zone_id: str
    timestamp: datetime
    moisture_start_pct: Optional[float] = None
    moisture_middle_pct: Optional[float] = None
    moisture_end_pct: Optional[float] = None
    avg_moisture_pct: Optional[float] = None
    uniformity_coefficient: Optional[float] = None
    created_at: datetime


# ── Dashboard / Analysis Models ──────────────────────────────

class BranchSummary(BaseModel):
    """Real-time branch status for dashboard."""
    branch_id: str
    branch_number: int
    branch_name: str
    valve_open: bool
    inlet_flow_lpm: float
    outlet_flow_lpm: float
    flow_delta_lpm: float
    leak_detected: bool
    inlet_pressure_mpa: float
    outlet_pressure_mpa: float
    moisture_start_pct: float
    moisture_middle_pct: float
    moisture_end_pct: float
    avg_moisture_pct: float
    uniformity_coefficient: float


class ZoneDashboardSummary(BaseModel):
    """Zone summary with per-branch detail."""
    zone_id: str
    zone_number: int
    zone_name: str
    is_active: bool
    branches: List[BranchSummary]
    avg_moisture_pct: float
    total_inlet_flow_lpm: float
    total_outlet_flow_lpm: float
    water_efficiency_pct: float
    leak_count: int
    stress_score: float
    stress_class: str
    health_score: float
    irrigation_needed: bool


class FarmDashboardSnapshot(BaseModel):
    """Complete farm dashboard — returned by GET /api/iot/dashboard."""
    farm_id: str
    timestamp: datetime
    total_zones: int
    total_branches: int
    active_zones: int
    active_branches: int
    environment: EnvironmentReadingCreate
    infrastructure: InfrastructureReadingCreate
    zones: List[ZoneDashboardSummary]
    total_water_consumption_lpm: float
    total_leak_alerts: int
    avg_water_efficiency_pct: float
    farm_avg_moisture_pct: float
    farm_health_score: float


class BranchAnalysis(BaseModel):
    """Detailed branch analysis over a time window."""
    branch_id: str
    branch_name: str
    period_hours: int
    flow_stats: dict
    moisture_stats: dict
    leak_events: int
    avg_uniformity: float
    avg_efficiency_pct: float
    recommendations: List[str]


class LeakAlert(BaseModel):
    """Individual leak detection alert."""
    branch_id: str
    branch_name: str
    zone_id: str
    zone_name: str
    timestamp: datetime
    inlet_flow_lpm: float
    outlet_flow_lpm: float
    flow_delta_lpm: float
    severity: str


class WaterConsumptionReport(BaseModel):
    """Water consumption breakdown."""
    period_hours: int
    farm_total_liters: float
    per_zone: List[dict]
    per_branch: List[dict]
    efficiency_pct: float
    estimated_loss_liters: float


# ── Column Lists for Alert Rules ──────────────────────────────

ENVIRONMENT_COLUMNS = [
    "air_temperature_c", "air_humidity_pct", "air_pressure_hpa",
    "light_intensity_lux", "solar_radiation_wm2", "precipitation_mm",
    "wind_speed_kmh", "cloud_cover_pct"
]

INFRASTRUCTURE_COLUMNS = [
    "reservoir_level_pct", "main_pump_flow_lpm", "main_pressure_mpa"
]

BRANCH_FLOW_COLUMNS = [
    "inlet_flow_lpm", "outlet_flow_lpm", "flow_delta_lpm",
    "inlet_pressure_mpa", "outlet_pressure_mpa"
]

SOIL_MOISTURE_COLUMNS = [
    "moisture_start_pct", "moisture_middle_pct", "moisture_end_pct",
    "avg_moisture_pct", "uniformity_coefficient"
]

ALERTABLE_COLUMNS_V3 = (
    ENVIRONMENT_COLUMNS + INFRASTRUCTURE_COLUMNS +
    BRANCH_FLOW_COLUMNS + SOIL_MOISTURE_COLUMNS +
    ["stress_score", "health_score", "water_efficiency_pct"]
)
