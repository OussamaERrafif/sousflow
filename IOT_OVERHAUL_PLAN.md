# SoussFlow IoT System Overhaul - Implementation Plan

## Overview

Transform SoussFlow from a flat zone-based IoT model (single `iot_readings` table, integer zone IDs, one moisture/flow value per zone) into a comprehensive, hierarchical Farm → Zone → Branch monitoring system with per-branch flow meters (inlet + outlet) and 3 soil moisture sensors per branch (start, middle, end).

### Current State

- Single `iot_readings` table with 26 columns (flat structure, one row per zone per timestamp)
- Zones are just integer IDs (1 to N) with no dedicated table
- No concept of irrigation branches within zones
- Single `soil_moisture_pct` per zone
- Single `zone_flow_lpm` per zone
- Simulator generates one reading per zone per cycle
- Frontend shows zone cards with moisture, pressure, flow

### Target State

```
Farm
├── Zone 1 (e.g. "North Slope")
│   ├── Branch 1 (drip irrigation line)
│   │   ├── Inlet Flow Meter ──→ inlet_flow_lpm
│   │   ├── Outlet Flow Meter ──→ outlet_flow_lpm
│   │   ├── Soil Sensor (start) ──→ moisture_start_pct
│   │   ├── Soil Sensor (middle) ──→ moisture_middle_pct
│   │   └── Soil Sensor (end) ──→ moisture_end_pct
│   ├── Branch 2
│   │   └── ... (same sensors)
│   └── Branch 3
│       └── ... (same sensors)
├── Zone 2
│   └── ...
├── Main Pump Flow Meter ──→ main_pump_flow_lpm
├── Reservoir Level Sensor ──→ reservoir_level_pct
├── Filter Status Sensor ──→ filter_status
└── Weather Station ──→ temperature, humidity, wind, solar, rain
```

### System Capabilities After Overhaul

| Capability | How It Works |
|---|---|
| Precise water usage tracking | Main pump flow + per-branch inlet/outlet meters |
| Early leak detection | `flow_delta = inlet - outlet`; alert if delta exceeds threshold |
| Blockage detection | Outlet flow drops to near-zero while inlet is normal |
| Irrigation efficiency | `efficiency = total_outlet / total_inlet × 100` |
| Soil moisture uniformity | Christiansen uniformity coefficient from 3 sensors per branch |
| Dry zone identification | Compare start/middle/end moisture to find gradient issues |
| Over-irrigation detection | All 3 sensors above optimal range |
| Automated irrigation decisions | Branch-level valve control based on moisture + stress |
| Historical trend analysis | Time-series queries per branch, zone, or farm |
| Real-time monitoring | SSE streaming with hierarchical zone → branch data |

---

## Phase 1: Database Schema

**Goal**: Create new normalized tables for the hierarchical data model. Keep `iot_readings` intact during transition.

### Step 1.1: Create Schema Migration File

**File**: `backend/supabase_schema_v3.sql`

```sql
-- ============================================================
-- SoussFlow IoT Schema v3 — Hierarchical Zone/Branch Model
-- ============================================================

-- 1. ZONES: First-class entities replacing integer zone_id
-- ============================================================
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    area_hectares DOUBLE PRECISION,
    plant_type TEXT DEFAULT 'olive',
    plant_species TEXT DEFAULT 'Olea europaea',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, zone_number)
);

CREATE INDEX IF NOT EXISTS idx_zones_farm ON zones(farm_id);

-- 2. BRANCHES: Drip irrigation lines within a zone
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    branch_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    length_meters DOUBLE PRECISION,
    emitter_count INTEGER,
    emitter_flow_lph DOUBLE PRECISION DEFAULT 4.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zone_id, branch_number)
);

CREATE INDEX IF NOT EXISTS idx_branches_zone ON branches(zone_id);

-- 3. ENVIRONMENT READINGS: Weather station data (one per farm per cycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS environment_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    air_temperature_c DOUBLE PRECISION,
    air_humidity_pct DOUBLE PRECISION,
    air_pressure_hpa DOUBLE PRECISION,
    light_intensity_lux DOUBLE PRECISION,
    solar_radiation_wm2 DOUBLE PRECISION,
    precipitation_mm DOUBLE PRECISION,
    wind_speed_kmh DOUBLE PRECISION,
    cloud_cover_pct DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_env_farm_ts
    ON environment_readings(farm_id, timestamp DESC);

-- 4. INFRASTRUCTURE READINGS: Reservoir, pump, filter (one per farm per cycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS infrastructure_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    reservoir_level_pct DOUBLE PRECISION,
    main_pump_flow_lpm DOUBLE PRECISION,
    main_pressure_mpa DOUBLE PRECISION,
    filter_status SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_farm_ts
    ON infrastructure_readings(farm_id, timestamp DESC);

-- 5. BRANCH FLOW READINGS: Inlet + outlet per branch per cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_flow_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    valve_open SMALLINT DEFAULT 0,
    inlet_flow_lpm DOUBLE PRECISION,
    outlet_flow_lpm DOUBLE PRECISION,
    inlet_pressure_mpa DOUBLE PRECISION,
    outlet_pressure_mpa DOUBLE PRECISION,
    flow_delta_lpm DOUBLE PRECISION GENERATED ALWAYS AS (
        COALESCE(inlet_flow_lpm, 0) - COALESCE(outlet_flow_lpm, 0)
    ) STORED,
    leak_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bf_branch_ts
    ON branch_flow_readings(branch_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bf_farm_ts
    ON branch_flow_readings(farm_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bf_zone_ts
    ON branch_flow_readings(zone_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bf_leaks
    ON branch_flow_readings(farm_id, timestamp DESC)
    WHERE leak_detected = TRUE;

-- 6. SOIL MOISTURE READINGS: 3 sensors per branch per cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS soil_moisture_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    moisture_start_pct DOUBLE PRECISION,
    moisture_middle_pct DOUBLE PRECISION,
    moisture_end_pct DOUBLE PRECISION,
    avg_moisture_pct DOUBLE PRECISION GENERATED ALWAYS AS (
        (COALESCE(moisture_start_pct, 0)
         + COALESCE(moisture_middle_pct, 0)
         + COALESCE(moisture_end_pct, 0)) / 3.0
    ) STORED,
    uniformity_coefficient DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sm_branch_ts
    ON soil_moisture_readings(branch_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sm_farm_ts
    ON soil_moisture_readings(farm_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sm_zone_ts
    ON soil_moisture_readings(zone_id, timestamp DESC);

-- 7. ZONE HEALTH READINGS: Aggregated per zone per cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS zone_health_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    avg_soil_moisture_pct DOUBLE PRECISION,
    total_inlet_flow_lpm DOUBLE PRECISION,
    total_outlet_flow_lpm DOUBLE PRECISION,
    water_efficiency_pct DOUBLE PRECISION,
    leak_count INTEGER DEFAULT 0,
    stress_score DOUBLE PRECISION,
    stress_class TEXT,
    health_score DOUBLE PRECISION,
    irrigation_needed SMALLINT DEFAULT 0,
    is_anomaly SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zh_zone_ts
    ON zone_health_readings(zone_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_zh_farm_ts
    ON zone_health_readings(farm_id, timestamp DESC);

-- 8. UPDATE alert_rules TO SUPPORT NEW COLUMNS
-- ============================================================
-- Add new alertable columns to the CHECK constraint.
-- If the existing constraint is named, drop and recreate it.
-- Otherwise, add new valid values:
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_metric_check;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_metric_check CHECK (
    metric IN (
        -- Legacy columns (backward compat)
        'air_temperature_c', 'air_humidity_pct', 'soil_moisture_pct',
        'main_pressure_mpa', 'zone_flow_lpm', 'zone_pressure_mpa',
        'light_intensity_lux', 'solar_radiation_wm2', 'precipitation_mm',
        'wind_speed_kmh', 'stress_score', 'health_score',
        'reservoir_level_pct', 'filter_status',
        -- New columns
        'inlet_flow_lpm', 'outlet_flow_lpm', 'flow_delta_lpm',
        'inlet_pressure_mpa', 'outlet_pressure_mpa',
        'moisture_start_pct', 'moisture_middle_pct', 'moisture_end_pct',
        'uniformity_coefficient', 'avg_moisture_pct',
        'main_pump_flow_lpm', 'water_efficiency_pct',
        'total_inlet_flow_lpm', 'total_outlet_flow_lpm'
    )
);

-- Add optional branch_id to alert_rules for branch-level alerts
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
```

### Step 1.2: Data Migration Script

**File**: `backend/migrations/001_migrate_to_v3.sql`

```sql
-- ============================================================
-- Migration: iot_readings (v2) → normalized tables (v3)
-- Run AFTER supabase_schema_v3.sql
-- ============================================================

-- Step 1: Create zones from distinct zone_ids in iot_readings
INSERT INTO zones (farm_id, zone_number, name, plant_type, plant_species)
SELECT DISTINCT
    farm_id,
    zone_id AS zone_number,
    'Zone ' || zone_id AS name,
    COALESCE(plant_type, 'olive'),
    COALESCE(plant_species, 'Olea europaea')
FROM iot_readings
WHERE farm_id IS NOT NULL AND zone_id IS NOT NULL
ON CONFLICT (farm_id, zone_number) DO NOTHING;

-- Step 2: Create one default branch per zone (old data has no branch concept)
INSERT INTO branches (zone_id, branch_number, name)
SELECT id, 1, 'Branch 1 (migrated)'
FROM zones
ON CONFLICT (zone_id, branch_number) DO NOTHING;

-- Step 3: Backfill environment_readings (deduplicated by farm + timestamp)
INSERT INTO environment_readings (
    farm_id, timestamp,
    air_temperature_c, air_humidity_pct, air_pressure_hpa,
    light_intensity_lux, solar_radiation_wm2, precipitation_mm,
    wind_speed_kmh, cloud_cover_pct
)
SELECT DISTINCT ON (farm_id, timestamp)
    farm_id, timestamp,
    air_temperature_c, air_humidity_pct, air_pressure_hpa,
    light_intensity_lux, solar_radiation_wm2, precipitation_mm,
    wind_speed_kmh, cloud_cover_pct
FROM iot_readings
WHERE farm_id IS NOT NULL
ORDER BY farm_id, timestamp, id;

-- Step 4: Backfill infrastructure_readings
INSERT INTO infrastructure_readings (
    farm_id, timestamp,
    reservoir_level_pct, main_pump_flow_lpm, main_pressure_mpa, filter_status
)
SELECT DISTINCT ON (farm_id, timestamp)
    farm_id, timestamp,
    reservoir_level_pct, NULL, main_pressure_mpa, filter_status
FROM iot_readings
WHERE farm_id IS NOT NULL
ORDER BY farm_id, timestamp, id;

-- Step 5: Backfill branch_flow_readings (map old zone data to default branch)
INSERT INTO branch_flow_readings (
    branch_id, farm_id, zone_id, timestamp,
    valve_open, inlet_flow_lpm, outlet_flow_lpm,
    inlet_pressure_mpa, outlet_pressure_mpa, leak_detected
)
SELECT
    b.id AS branch_id,
    r.farm_id,
    z.id AS zone_id,
    r.timestamp,
    r.valve_open,
    r.zone_flow_lpm,          -- old single flow → inlet
    r.zone_flow_lpm * 0.95,   -- estimated outlet (5% loss assumed)
    r.zone_pressure_mpa,      -- old pressure → inlet pressure
    r.zone_pressure_mpa * 0.90,
    FALSE
FROM iot_readings r
JOIN zones z ON z.farm_id = r.farm_id AND z.zone_number = r.zone_id
JOIN branches b ON b.zone_id = z.id AND b.branch_number = 1
WHERE r.farm_id IS NOT NULL;

-- Step 6: Backfill soil_moisture_readings (single value → all 3 sensors equal)
INSERT INTO soil_moisture_readings (
    branch_id, farm_id, zone_id, timestamp,
    moisture_start_pct, moisture_middle_pct, moisture_end_pct,
    uniformity_coefficient
)
SELECT
    b.id AS branch_id,
    r.farm_id,
    z.id AS zone_id,
    r.timestamp,
    r.soil_moisture_pct,           -- start = original value
    r.soil_moisture_pct * 0.97,    -- middle = slight decrease
    r.soil_moisture_pct * 0.94,    -- end = further decrease
    0.98                           -- near-perfect uniformity (estimated)
FROM iot_readings r
JOIN zones z ON z.farm_id = r.farm_id AND z.zone_number = r.zone_id
JOIN branches b ON b.zone_id = z.id AND b.branch_number = 1
WHERE r.farm_id IS NOT NULL AND r.soil_moisture_pct IS NOT NULL;

-- Step 7: Backfill zone_health_readings
INSERT INTO zone_health_readings (
    zone_id, farm_id, timestamp,
    avg_soil_moisture_pct, total_inlet_flow_lpm, total_outlet_flow_lpm,
    water_efficiency_pct, leak_count,
    stress_score, stress_class, health_score,
    irrigation_needed, is_anomaly
)
SELECT
    z.id AS zone_id,
    r.farm_id,
    r.timestamp,
    r.soil_moisture_pct,
    r.zone_flow_lpm,
    r.zone_flow_lpm * 0.95,
    95.0,
    0,
    r.stress_score,
    r.stress_class,
    r.health_score,
    r.irrigation_needed,
    r.is_anomaly
FROM iot_readings r
JOIN zones z ON z.farm_id = r.farm_id AND z.zone_number = r.zone_id
WHERE r.farm_id IS NOT NULL;

-- Step 8: Rename legacy table (keep for rollback safety)
ALTER TABLE iot_readings RENAME TO iot_readings_legacy;
```

### Step 1.3: Update Config

**File**: `backend/app/config.py` — add new settings:

```python
IOT_SIMULATOR_BRANCHES_PER_ZONE: int = 3
IOT_SIMULATOR_LEAK_PROBABILITY: float = 0.02  # 2% chance per branch per cycle
```

---

## Phase 2: Backend Pydantic Schemas

### Step 2.1: Create Zone/Branch Schemas

**File**: `backend/app/schemas/zone.py` (new file)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ZoneCreate(BaseModel):
    zone_number: int = Field(..., ge=1, le=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    area_hectares: Optional[float] = Field(None, ge=0)
    plant_type: str = "olive"
    plant_species: str = "Olea europaea"
    is_active: bool = True


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    area_hectares: Optional[float] = Field(None, ge=0)
    plant_type: Optional[str] = None
    plant_species: Optional[str] = None
    is_active: Optional[bool] = None


class ZoneResponse(BaseModel):
    id: str
    farm_id: str
    zone_number: int
    name: str
    description: Optional[str] = None
    area_hectares: Optional[float] = None
    plant_type: str
    plant_species: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BranchCreate(BaseModel):
    branch_number: int = Field(..., ge=1, le=50)
    name: str = Field(..., min_length=1, max_length=100)
    length_meters: Optional[float] = Field(None, ge=0)
    emitter_count: Optional[int] = Field(None, ge=0)
    emitter_flow_lph: float = 4.0
    is_active: bool = True


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    length_meters: Optional[float] = Field(None, ge=0)
    emitter_count: Optional[int] = Field(None, ge=0)
    emitter_flow_lph: Optional[float] = None
    is_active: Optional[bool] = None


class BranchResponse(BaseModel):
    id: str
    zone_id: str
    branch_number: int
    name: str
    length_meters: Optional[float] = None
    emitter_count: Optional[int] = None
    emitter_flow_lph: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ZoneWithBranches(ZoneResponse):
    branches: List[BranchResponse] = []
```

### Step 2.2: Rewrite IoT Schemas

**File**: `backend/app/schemas/iot.py` — replace monolithic model with granular schemas

New/replacement models:

```python
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
    timestamp: Optional[datetime] = None  # defaults to now()
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
    flow_stats: dict       # min, max, mean, std for inlet/outlet
    moisture_stats: dict   # min, max, mean, std for start/middle/end
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
    severity: str  # "warning" | "critical"


class WaterConsumptionReport(BaseModel):
    """Water consumption breakdown."""
    period_hours: int
    farm_total_liters: float
    per_zone: List[dict]   # [{zone_id, zone_name, liters, pct_of_total}]
    per_branch: List[dict] # [{branch_id, branch_name, zone_name, liters}]
    efficiency_pct: float
    estimated_loss_liters: float
```

### Step 2.3: Keep Legacy Compatibility

Keep the existing `IoTReadingCreate` class in `iot.py` with a deprecation comment. Add a helper function:

```python
def legacy_reading_to_cycle(reading: IoTReadingCreate, branch_id: str) -> IoTCycleCreate:
    """Convert old flat reading format to new cycle format."""
    ...
```

---

## Phase 3: Backend Services

### Step 3.1: Create Zone Service

**File**: `backend/app/services/zone_service.py` (new file)

Functions to implement:

```python
async def create_zone(farm_id: str, data: ZoneCreate) -> dict
async def list_zones(farm_id: str, include_inactive: bool = False) -> list[dict]
async def get_zone(zone_id: str) -> dict
async def get_zone_with_branches(zone_id: str) -> dict
async def update_zone(zone_id: str, data: ZoneUpdate) -> dict
async def delete_zone(zone_id: str) -> None

async def create_branch(zone_id: str, data: BranchCreate) -> dict
async def list_branches(zone_id: str, include_inactive: bool = False) -> list[dict]
async def get_branch(branch_id: str) -> dict
async def update_branch(branch_id: str, data: BranchUpdate) -> dict
async def delete_branch(branch_id: str) -> None

async def get_farm_topology(farm_id: str) -> dict
    """Returns full farm → zones → branches hierarchy."""

async def auto_create_topology(farm_id: str, num_zones: int, branches_per_zone: int) -> dict
    """Auto-creates zones and branches for simulator startup."""
```

All functions use `supabase_client` directly (matching existing pattern in `farm_service.py`).

### Step 3.2: Rewrite IoT Service

**File**: `backend/app/services/iot_service.py`

#### New Core Functions

```python
# ── Ingest ───────────────────────────────────────────────────

async def ingest_cycle(farm_id: str, cycle: IoTCycleCreate) -> dict:
    """Ingest one complete reading cycle.

    Steps:
    1. Insert environment_readings row
    2. Insert infrastructure_readings row
    3. For each branch in cycle.branches:
       a. Compute flow_delta and leak_detected
       b. Insert branch_flow_readings row
       c. Compute uniformity_coefficient
       d. Insert soil_moisture_readings row
    4. Aggregate per-zone metrics → insert zone_health_readings
    5. Check alert rules
    6. Return summary with counts and any alerts triggered
    """


async def ingest_legacy_reading(farm_id: str, reading: IoTReadingCreate) -> dict:
    """Backward-compatible ingest that converts flat format to cycle format."""


# ── Queries ──────────────────────────────────────────────────

async def query_environment(
    farm_id: str, start: datetime, end: datetime, limit: int = 100
) -> list[dict]:
    """Query environment readings for a farm in a time range."""


async def query_infrastructure(
    farm_id: str, start: datetime, end: datetime, limit: int = 100
) -> list[dict]:
    """Query infrastructure readings for a farm in a time range."""


async def query_branch_flow(
    farm_id: str, branch_id: str, start: datetime, end: datetime, limit: int = 100
) -> list[dict]:
    """Query flow readings for a specific branch."""


async def query_branch_soil(
    farm_id: str, branch_id: str, start: datetime, end: datetime, limit: int = 100
) -> list[dict]:
    """Query soil moisture readings for a specific branch."""


async def query_zone_health(
    farm_id: str, zone_id: str, start: datetime, end: datetime, limit: int = 100
) -> list[dict]:
    """Query zone health readings for a specific zone."""


async def get_latest_per_zone(farm_id: str) -> list[dict]:
    """Get latest readings for each zone with branch details.

    For each zone:
    1. Fetch latest zone_health_readings row
    2. Fetch latest branch_flow_readings + soil_moisture_readings per branch
    3. Combine into ZoneDashboardSummary
    """


# ── Dashboard ────────────────────────────────────────────────

async def get_dashboard(farm_id: str) -> FarmDashboardSnapshot:
    """Build complete farm dashboard snapshot.

    1. Fetch farm topology (zones + branches)
    2. Fetch latest environment_readings
    3. Fetch latest infrastructure_readings
    4. For each zone → for each branch:
       - Fetch latest branch_flow_readings
       - Fetch latest soil_moisture_readings
       - Build BranchSummary
    5. Aggregate zone-level metrics
    6. Compute farm-level totals
    """


# ── Analysis ─────────────────────────────────────────────────

async def analyze_branch(
    farm_id: str, branch_id: str, hours: int = 24
) -> BranchAnalysis:
    """Detailed analysis of one branch over time.

    - Flow statistics (min/max/mean/std for inlet and outlet)
    - Moisture statistics (min/max/mean/std for start/middle/end)
    - Leak event count and durations
    - Average uniformity coefficient
    - Average water efficiency
    - Recommendations
    """


async def analyze_zone(
    farm_id: str, zone_id: str, hours: int = 24
) -> dict:
    """Zone-level analysis aggregating all branches.
    Rewritten to use new tables instead of iot_readings.
    """


async def get_leak_alerts(farm_id: str, hours: int = 24) -> list[LeakAlert]:
    """Get all leak detections across the farm in the time window."""


async def get_water_consumption(
    farm_id: str, hours: int = 24
) -> WaterConsumptionReport:
    """Water consumption breakdown by zone and branch.

    Uses infrastructure_readings (main pump) and branch_flow_readings
    to compute total consumption, per-zone/branch breakdown, and efficiency.
    """
```

#### New Helper Functions

```python
def compute_uniformity_coefficient(start: float, middle: float, end: float) -> float:
    """Christiansen's uniformity coefficient from 3 sensor values.
    CU = 1 - (sum of |deviation from mean|) / (n × mean)
    Returns value between 0.0 (non-uniform) and 1.0 (perfectly uniform).
    """
    values = [start, middle, end]
    mean = sum(values) / 3
    if mean <= 0:
        return 0.0
    deviations = sum(abs(v - mean) for v in values)
    return round(1 - (deviations / (3 * mean)), 4)


def detect_leak(inlet_flow: float, outlet_flow: float, threshold_pct: float = 0.10) -> bool:
    """Leak detection: True if outlet is more than threshold% less than inlet.
    Default threshold: 10% flow loss indicates a leak.
    """
    if inlet_flow <= 0:
        return False
    delta_pct = (inlet_flow - outlet_flow) / inlet_flow
    return delta_pct > threshold_pct


def compute_water_efficiency(total_inlet: float, total_outlet: float) -> float:
    """Water delivery efficiency = (outlet / inlet) × 100.
    100% = perfect delivery, lower = more loss.
    """
    if total_inlet <= 0:
        return 100.0
    return round((total_outlet / total_inlet) * 100, 2)


def classify_leak_severity(flow_delta_lpm: float, inlet_flow_lpm: float) -> str:
    """Classify leak severity based on flow delta percentage.
    - "warning": 10-25% loss
    - "critical": >25% loss
    """
    if inlet_flow_lpm <= 0:
        return "warning"
    pct = (flow_delta_lpm / inlet_flow_lpm) * 100
    return "critical" if pct > 25 else "warning"
```

#### Updated Constants

```python
# Replace NUMERIC_COLUMNS with table-specific column lists
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

ALERTABLE_COLUMNS = (
    ENVIRONMENT_COLUMNS + INFRASTRUCTURE_COLUMNS +
    BRANCH_FLOW_COLUMNS + SOIL_MOISTURE_COLUMNS +
    ["stress_score", "health_score", "water_efficiency_pct"]
)
```

#### Updated Recommendation Engine

Extend `generate_recommendations()` with new branch-level recommendations:

```python
# New recommendation types to add:
# - "leak_detected": Branch X shows {delta}% flow loss — inspect for leaks
# - "blockage_suspected": Branch X outlet flow near zero with normal inlet
# - "low_uniformity": Branch X uniformity {CU} below 0.85 — check emitters
# - "moisture_gradient": Branch X shows steep moisture drop (start→end)
# - "over_irrigation": Branch X all 3 sensors above 75% — reduce watering
# - "dry_zone": Branch X end sensor below 20% — extend irrigation time
# - "pump_efficiency": Main pump output vs sum of branch inlets diverges
```

---

## Phase 4: Backend Routes & Simulator

### Step 4.1: Create Zone Routes

**File**: `backend/app/routes/zone_routes.py` (new file)

```python
router = APIRouter(prefix="/api/farms/{farm_id}/zones", tags=["zones"])

@router.post("/", response_model=ZoneResponse, status_code=201)
async def create_zone(farm_id: str, data: ZoneCreate, user=Depends(get_current_user)):
    """Create a new zone in a farm. Requires farm_owner or superadmin role."""

@router.get("/", response_model=List[ZoneWithBranches])
async def list_zones(farm_id: str, user=Depends(get_current_user)):
    """List all zones with their branches for a farm."""

@router.get("/{zone_id}", response_model=ZoneWithBranches)
async def get_zone(farm_id: str, zone_id: str, user=Depends(get_current_user)):
    """Get a specific zone with its branches."""

@router.put("/{zone_id}", response_model=ZoneResponse)
async def update_zone(farm_id: str, zone_id: str, data: ZoneUpdate, user=Depends(get_current_user)):
    """Update zone details."""

@router.delete("/{zone_id}", status_code=204)
async def delete_zone(farm_id: str, zone_id: str, user=Depends(get_current_user)):
    """Delete a zone and all its branches/readings. Requires farm_owner or superadmin."""

@router.post("/{zone_id}/branches", response_model=BranchResponse, status_code=201)
async def create_branch(farm_id: str, zone_id: str, data: BranchCreate, user=Depends(get_current_user)):
    """Create a new irrigation branch in a zone."""

@router.get("/{zone_id}/branches", response_model=List[BranchResponse])
async def list_branches(farm_id: str, zone_id: str, user=Depends(get_current_user)):
    """List all branches in a zone."""

@router.put("/{zone_id}/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(...):
    """Update branch details."""

@router.delete("/{zone_id}/branches/{branch_id}", status_code=204)
async def delete_branch(...):
    """Delete a branch and all its readings."""
```

### Step 4.2: Update IoT Routes

**File**: `backend/app/routes/iot_routes.py`

Add new endpoints (keep existing ones with deprecation comments):

```python
# ── New Ingest ───────────────────────────────────────────────

@router.post("/readings/cycle", status_code=201)
async def ingest_cycle(data: IoTCycleCreate, user=Depends(get_current_user)):
    """Ingest a complete reading cycle (environment + infra + all branches)."""

# ── New Queries ──────────────────────────────────────────────

@router.get("/readings/environment")
async def query_environment(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user)
):
    """Query environment (weather) readings."""

@router.get("/readings/infrastructure")
async def query_infrastructure(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user)
):
    """Query infrastructure (reservoir, pump, filter) readings."""

@router.get("/readings/branch/{branch_id}/flow")
async def query_branch_flow(
    branch_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user)
):
    """Query flow meter readings for a specific branch."""

@router.get("/readings/branch/{branch_id}/soil")
async def query_branch_soil(
    branch_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user)
):
    """Query soil moisture readings for a specific branch."""

@router.get("/readings/zone/{zone_id}/health")
async def query_zone_health(
    zone_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user)
):
    """Query zone health aggregate readings."""

# ── New Analysis ─────────────────────────────────────────────

@router.get("/analyze/branch/{branch_id}")
async def analyze_branch(
    branch_id: str,
    hours: int = Query(24, ge=1, le=720),
    user=Depends(get_current_user)
):
    """Detailed analysis of a specific branch."""

@router.get("/leaks")
async def get_leak_alerts(
    hours: int = Query(24, ge=1, le=720),
    user=Depends(get_current_user)
):
    """Get all leak detection alerts across the farm."""

@router.get("/water-consumption")
async def get_water_consumption(
    hours: int = Query(24, ge=1, le=720),
    user=Depends(get_current_user)
):
    """Get water consumption breakdown by zone and branch."""

# ── Updated Dashboard ────────────────────────────────────────

@router.get("/dashboard")  # same path, new response model
async def get_dashboard(user=Depends(get_current_user)):
    """Farm dashboard with hierarchical zone/branch data.
    Returns FarmDashboardSnapshot."""
```

### Step 4.3: Register New Routes

**File**: `backend/main.py`

```python
from app.routes.zone_routes import router as zone_router
app.include_router(zone_router)
```

### Step 4.4: Rewrite IoT Simulator

**File**: `backend/app/services/iot_simulator.py`

This is the most complex change. The simulator needs to:

#### New State Structure

```python
@dataclass
class BranchState:
    branch_id: str
    zone_id: str
    branch_number: int
    soil_start: float    # moisture at pipe start
    soil_middle: float   # moisture at pipe middle
    soil_end: float      # moisture at pipe end
    valve_open: bool
    has_leak: bool       # persistent leak state
    leak_severity: float # 0.0 to 0.5 (fraction of flow lost)
    has_blockage: bool

@dataclass
class ZoneState:
    zone_id: str
    zone_number: int
    branches: dict[str, BranchState]  # branch_id → state

class IoTSimulator:
    def __init__(self, farm_id, zones_config, ...):
        self.farm_id = farm_id
        self.zones: dict[str, ZoneState] = {}
        self.reservoir: float = 75.0
        self.filter_status: int = 0
        self.main_pump_active: bool = True
```

#### Initialization Flow

```python
async def initialize(self):
    """Fetch or create farm topology, then initialize state."""
    # 1. Query zones table for self.farm_id
    # 2. If no zones exist, call auto_create_topology()
    # 3. For each zone, query branches
    # 4. Initialize BranchState for each branch with:
    #    - soil_start: random 35-55%
    #    - soil_middle: soil_start - random(2-5)
    #    - soil_end: soil_middle - random(2-5)
    #    - valve_open: True
    #    - has_leak: False
    #    - has_blockage: False
```

#### Reading Generation

```python
async def generate_cycle(self) -> IoTCycleCreate:
    """Generate one complete reading cycle."""
    now = datetime.utcnow()

    # 1. Generate environment data (same Agadir climate model)
    env = self._generate_environment(now)

    # 2. Generate infrastructure data
    infra = self._generate_infrastructure(now)

    # 3. For each zone → for each branch:
    branch_data = []
    for zone in self.zones.values():
        for branch in zone.branches.values():
            # a. Compute inlet flow based on:
            #    - main pressure
            #    - valve state
            #    - filter degradation
            #    - time of day (scheduled irrigation windows)
            inlet_flow = self._compute_inlet_flow(branch, infra)

            # b. Compute outlet flow:
            #    - Normal: inlet × (0.95 to 0.99) — small delivery loss
            #    - Leak: inlet × (1 - leak_severity)
            #    - Blockage: near zero
            outlet_flow = self._compute_outlet_flow(branch, inlet_flow)

            # c. Update soil moisture:
            #    - Start sensor: gains most from irrigation
            #    - Middle sensor: moderate gain
            #    - End sensor: least gain (pressure drops along pipe)
            #    - All lose moisture to ET (evapotranspiration)
            self._update_soil_moisture(branch, outlet_flow, env, now)

            # d. Inject random faults (leak, blockage)
            self._maybe_inject_fault(branch)

            # e. Build branch cycle data
            branch_data.append(BranchCycleData(
                branch_id=branch.branch_id,
                flow=BranchFlowReadingCreate(
                    branch_id=branch.branch_id,
                    valve_open=1 if branch.valve_open else 0,
                    inlet_flow_lpm=inlet_flow,
                    outlet_flow_lpm=outlet_flow,
                    inlet_pressure_mpa=...,
                    outlet_pressure_mpa=...
                ),
                soil=SoilMoistureReadingCreate(
                    branch_id=branch.branch_id,
                    moisture_start_pct=branch.soil_start,
                    moisture_middle_pct=branch.soil_middle,
                    moisture_end_pct=branch.soil_end
                )
            ))

    # 4. Build and return full cycle
    return IoTCycleCreate(
        timestamp=now,
        environment=env,
        infrastructure=infra,
        branches=branch_data
    )
```

#### Soil Moisture Physics (per branch)

```python
def _update_soil_moisture(self, branch: BranchState, outlet_flow: float,
                          env: EnvironmentReadingCreate, now: datetime):
    """Update 3 soil moisture sensors with realistic physics.

    Irrigation effect (when valve is open):
    - start sensor: +0.8 × irrigation_factor
    - middle sensor: +0.5 × irrigation_factor
    - end sensor: +0.3 × irrigation_factor (less water reaches end)

    Evapotranspiration loss (always):
    - Higher temperature → more loss
    - Higher wind → more loss
    - Higher humidity → less loss
    - Loss is equal across all 3 sensors

    Rainfall effect (uniform across branch):
    - All 3 sensors gain equally from rain

    Clamp all values to [0, 100].
    """
```

#### Leak/Fault Simulation

```python
def _maybe_inject_fault(self, branch: BranchState):
    """Random fault injection per branch per cycle.

    - Leak: 2% chance per cycle to develop a new leak
    - Leak repair: 5% chance per cycle for existing leak to be "fixed"
    - Blockage: 0.5% chance per cycle
    - Blockage clear: 10% chance per cycle for existing blockage to clear
    """
```

#### SSE Export

```python
def get_sse_payload(self) -> dict:
    """Build structured payload for SSE streaming.

    Returns:
    {
        "environment": {...},
        "infrastructure": {...},
        "zones": [
            {
                "zone_id": "uuid",
                "zone_number": 1,
                "name": "Zone 1",
                "branches": [
                    {
                        "branch_id": "uuid",
                        "branch_number": 1,
                        "inlet_flow_lpm": 1.5,
                        "outlet_flow_lpm": 1.4,
                        "flow_delta_lpm": 0.1,
                        "leak_detected": false,
                        "moisture_start_pct": 52.3,
                        "moisture_middle_pct": 48.1,
                        "moisture_end_pct": 44.7,
                        "uniformity_coefficient": 0.94,
                        "valve_open": 1
                    }
                ],
                "avg_moisture_pct": 48.4,
                "total_inlet_flow_lpm": 4.5,
                "total_outlet_flow_lpm": 4.2,
                "water_efficiency_pct": 93.3,
                "health_score": 8.2,
                "stress_class": "none",
                "leak_count": 0
            }
        ],
        "simulator_running": true,
        "timestamp": "2026-03-17T12:00:00Z"
    }
    """
```

### Step 4.5: Update SSE Endpoint

**File**: `backend/main.py`

Update the `/api/events` SSE endpoint to stream the new structured payload from `simulator.get_sse_payload()` instead of the old flat readings list.

### Step 4.6: Update Simulator Control Endpoints

**File**: `backend/app/routes/iot_routes.py`

Update simulator injection endpoints:

```python
# Keep existing injection endpoints but adapt to branch-level:
@router.post("/simulator/inject/leak")
async def inject_leak(branch_id: str, severity: float = 0.3):
    """Inject a leak into a specific branch."""

@router.post("/simulator/inject/blockage")
async def inject_blockage(branch_id: str):
    """Inject a blockage into a specific branch."""

@router.post("/simulator/inject/irrigation")
async def inject_irrigation(zone_id: Optional[str] = None, branch_id: Optional[str] = None):
    """Toggle irrigation for a zone or specific branch."""

# Keep existing reservoir, filter injection endpoints
```

---

## Phase 5: Frontend

### Step 5.1: Update Redux IoT Slice

**File**: `frontend/src/lib/store/slices/iotSlice.ts`

Replace flat `IoTReading` interface with hierarchical types:

```typescript
// ── Branch-level data ──────────────────────────────────────

export interface BranchReading {
  branch_id: string;
  branch_number: number;
  branch_name: string;
  valve_open: number;
  inlet_flow_lpm: number;
  outlet_flow_lpm: number;
  flow_delta_lpm: number;
  leak_detected: boolean;
  inlet_pressure_mpa: number;
  outlet_pressure_mpa: number;
  moisture_start_pct: number;
  moisture_middle_pct: number;
  moisture_end_pct: number;
  avg_moisture_pct: number;
  uniformity_coefficient: number;
}

// ── Zone-level data ────────────────────────────────────────

export interface ZoneReading {
  zone_id: string;
  zone_number: number;
  zone_name: string;
  is_active: boolean;
  branches: BranchReading[];
  avg_moisture_pct: number;
  total_inlet_flow_lpm: number;
  total_outlet_flow_lpm: number;
  water_efficiency_pct: number;
  leak_count: number;
  stress_score: number;
  stress_class: string;
  health_score: number;
  irrigation_needed: boolean;
}

// ── Farm-level shared data ─────────────────────────────────

export interface EnvironmentReading {
  air_temperature_c: number;
  air_humidity_pct: number;
  air_pressure_hpa: number;
  light_intensity_lux: number;
  solar_radiation_wm2: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  cloud_cover_pct: number;
}

export interface InfrastructureReading {
  reservoir_level_pct: number;
  main_pump_flow_lpm: number;
  main_pressure_mpa: number;
  filter_status: number;
}

// ── SSE Payload ────────────────────────────────────────────

export interface SSEPayload {
  environment: EnvironmentReading;
  infrastructure: InfrastructureReading;
  zones: ZoneReading[];
  simulator_running: boolean;
  timestamp: string;
}

// ── State ──────────────────────────────────────────────────

export interface IoTState {
  environment: EnvironmentReading | null;
  infrastructure: InfrastructureReading | null;
  zones: ZoneReading[];
  simulatorRunning: boolean;
  lastUpdate: string | null;
  connected: boolean;
}
```

Update the `setLiveData` reducer to parse the new SSE payload shape.

### Step 5.2: Run Codegen

After all backend changes are deployed and the backend is running:

```bash
cd frontend && npm run codegen
```

This regenerates `src/lib/store/generated/api.ts` with all new endpoints.

### Step 5.3: Update ZoneGrid Component

**File**: `frontend/src/components/ZoneGrid.tsx`

Rewrite to display hierarchical data:

```
┌─────────────────────────────────────────────────┐
│ Zone 1 — North Slope                    ● Good  │
│ Avg Moisture: 48.4%  |  Flow: 4.5 L/min        │
│ Efficiency: 93.3%    |  Health: 8.2/10          │
│─────────────────────────────────────────────────│
│ ▼ Branch 1                                      │
│   Flow: 1.5 → 1.4 L/min  (Δ 0.1) ● OK         │
│   Moisture: [52.3%]──[48.1%]──[44.7%]  CU: 94% │
│ ▼ Branch 2                                      │
│   Flow: 1.5 → 1.0 L/min  (Δ 0.5) ⚠ LEAK       │
│   Moisture: [50.1%]──[46.3%]──[42.1%]  CU: 92% │
│ ▶ Branch 3 (collapsed)                          │
└─────────────────────────────────────────────────┘
```

Each zone card should:
- Show zone summary at top (avg moisture, total flow, efficiency, health)
- Color-code zone status: green (good), yellow (warning), red (critical/leak)
- List branches with expandable detail
- Each branch shows: inlet→outlet flow with delta, leak indicator, 3-point moisture bar, uniformity

### Step 5.4: Update ZonesPage

**File**: `frontend/src/components/pages/ZonesPage.tsx`

Restructure the page layout:

```
┌───────────────────────────────────────────────────────────┐
│ FARM OVERVIEW BAR                                         │
│ 🌡 24°C  💧 48% avg moisture  🔧 Filter: Clean           │
│ 💦 Reservoir: 72%  ⚡ Pump: 12.5 L/min  📊 Eff: 93%     │
├───────────────────────────────────────────────────────────┤
│ ⚠ LEAK ALERTS (2)                                        │
│ • Zone 1 / Branch 2: 33% flow loss — Critical            │
│ • Zone 3 / Branch 1: 12% flow loss — Warning             │
├───────────────────────────────────────────────────────────┤
│ ZONES                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Zone 1   │ │ Zone 2   │ │ Zone 3   │ │ Zone 4   │     │
│ │ ● Good   │ │ ⚠ Warn   │ │ ● Good   │ │ ● Good   │     │
│ │ 48.4%    │ │ 35.2%    │ │ 52.1%    │ │ 44.8%    │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├───────────────────────────────────────────────────────────┤
│ SELECTED ZONE DETAIL (Zone 1)                             │
│ ┌─────────────────────────────────────────────────┐      │
│ │ Branch 1  │  Branch 2  │  Branch 3              │      │
│ │ (detailed cards with flow, moisture, uniformity) │      │
│ └─────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────┘
```

### Step 5.5: Create New Components

#### `frontend/src/components/BranchCard.tsx`

Individual branch monitoring card:

```
┌────────────────────────────────────────┐
│ Branch 1                    🟢 Normal  │
│────────────────────────────────────────│
│ FLOW METERS                            │
│ Inlet:  1.50 L/min  ─────→            │
│ Outlet: 1.42 L/min  ─────→            │
│ Delta:  0.08 L/min (5.3%)             │
│ Pressure: 0.32 → 0.28 MPa            │
│────────────────────────────────────────│
│ SOIL MOISTURE                          │
│ ●────────────●────────────●            │
│ Start  52.3%  Mid  48.1%  End  44.7%  │
│ Uniformity: 94%  ████████████░░ Good   │
│────────────────────────────────────────│
│ 🔧 Valve: OPEN                        │
└────────────────────────────────────────┘
```

#### `frontend/src/components/LeakDetectionPanel.tsx`

Farm-wide leak monitoring panel:

```
┌────────────────────────────────────────────────────┐
│ 🔍 LEAK DETECTION                    2 alerts     │
│────────────────────────────────────────────────────│
│ 🔴 CRITICAL — Zone 1 / Branch 2                   │
│    Inlet: 1.50 L/min  Outlet: 1.00 L/min          │
│    Loss: 0.50 L/min (33.3%)                        │
│    Duration: 15 min  |  Est. waste: 7.5 L          │
│────────────────────────────────────────────────────│
│ 🟡 WARNING — Zone 3 / Branch 1                    │
│    Inlet: 1.20 L/min  Outlet: 1.05 L/min          │
│    Loss: 0.15 L/min (12.5%)                        │
│    Duration: 5 min  |  Est. waste: 0.75 L          │
└────────────────────────────────────────────────────┘
```

#### `frontend/src/components/MoistureUniformityBar.tsx`

Visual representation of 3 sensors along a branch:

```
  Start         Middle          End
  52.3%         48.1%          44.7%
    ●─────────────●─────────────●
   ████          ████           ███
  (blue)       (green)       (yellow)

  Uniformity: 94%  [████████████░░░]
```

Color coding:
- Blue (>55%): Over-irrigated
- Green (30-55%): Optimal for olives
- Yellow (20-30%): Dry — needs water
- Red (<20%): Critical — immediate irrigation needed

#### `frontend/src/components/WaterConsumptionChart.tsx`

Water usage breakdown visualization:

```
┌────────────────────────────────────────────────────┐
│ 💧 WATER CONSUMPTION (24h)                         │
│────────────────────────────────────────────────────│
│ Total Pumped: 1,250 L                              │
│ Total Delivered: 1,163 L                           │
│ Estimated Loss: 87 L (7.0%)                        │
│ Efficiency: 93.0%                                  │
│────────────────────────────────────────────────────│
│ BY ZONE:                                           │
│ Zone 1  ████████████████░░░░  420 L (33.6%)       │
│ Zone 2  ██████████████░░░░░░  380 L (30.4%)       │
│ Zone 3  ██████████░░░░░░░░░░  250 L (20.0%)       │
│ Zone 4  ████████░░░░░░░░░░░░  200 L (16.0%)       │
└────────────────────────────────────────────────────┘
```

### Step 5.6: Update i18n Translations

**Files**: `frontend/messages/ar.json`, `frontend/messages/fr.json`

Add new translation keys:

```json
{
  "iot": {
    "branch": "الفرع",
    "branches": "الفروع",
    "inletFlow": "تدفق المدخل",
    "outletFlow": "تدفق المخرج",
    "flowDelta": "فرق التدفق",
    "leakDetected": "تسرب مكتشف",
    "noLeaks": "لا تسربات",
    "moistureStart": "رطوبة البداية",
    "moistureMiddle": "رطوبة الوسط",
    "moistureEnd": "رطوبة النهاية",
    "uniformity": "معامل التجانس",
    "waterEfficiency": "كفاءة المياه",
    "totalConsumption": "إجمالي الاستهلاك",
    "estimatedLoss": "الفقد المقدر",
    "mainPump": "المضخة الرئيسية",
    "leakAlerts": "تنبيهات التسرب",
    "critical": "حرج",
    "warning": "تحذير",
    "blockageDetected": "انسداد مكتشف",
    "valveOpen": "صمام مفتوح",
    "valveClosed": "صمام مغلق"
  }
}
```

---

## Implementation Sequence

```
Phase 1 (DB)
  │
  ├── 1.1 Create supabase_schema_v3.sql
  ├── 1.2 Create migration script
  ├── 1.3 Update config.py
  │   ↓ Run schema on Supabase, then migration
  │
Phase 2 (Schemas)
  │
  ├── 2.1 Create schemas/zone.py
  ├── 2.2 Rewrite schemas/iot.py
  ├── 2.3 Add legacy compatibility adapter
  │
Phase 3 (Services)
  │
  ├── 3.1 Create services/zone_service.py
  ├── 3.2 Rewrite services/iot_service.py
  │
Phase 4 (Routes + Simulator)
  │
  ├── 4.1 Create routes/zone_routes.py
  ├── 4.2 Update routes/iot_routes.py
  ├── 4.3 Register routes in main.py
  ├── 4.4 Rewrite services/iot_simulator.py
  ├── 4.5 Update SSE endpoint in main.py
  ├── 4.6 Update simulator control endpoints
  │   ↓ Backend fully functional — test all endpoints
  │
Phase 5 (Frontend)
  │
  ├── 5.1 Update iotSlice.ts
  ├── 5.2 Run npm run codegen
  ├── 5.3 Rewrite ZoneGrid.tsx
  ├── 5.4 Rewrite ZonesPage.tsx
  ├── 5.5 Create new components:
  │   ├── BranchCard.tsx
  │   ├── LeakDetectionPanel.tsx
  │   ├── MoistureUniformityBar.tsx
  │   └── WaterConsumptionChart.tsx
  └── 5.6 Update i18n translations
```

---

## Testing Checklist

### Backend Tests

- [ ] Zone CRUD: create, list, get, update, delete zones
- [ ] Branch CRUD: create, list, get, update, delete branches
- [ ] Auto-topology creation: simulator creates zones/branches if none exist
- [ ] Cycle ingest: full cycle with environment + infra + N branches
- [ ] Legacy ingest: old flat format still works via adapter
- [ ] Leak detection: `detect_leak()` correctly flags flow deltas > 10%
- [ ] Uniformity coefficient: `compute_uniformity_coefficient()` returns correct CU
- [ ] Water efficiency: `compute_water_efficiency()` returns correct percentage
- [ ] Dashboard endpoint: returns `FarmDashboardSnapshot` with all zones and branches
- [ ] Branch analysis: returns stats, leak events, recommendations
- [ ] Leak alerts endpoint: returns all branches with active leaks
- [ ] Water consumption endpoint: returns per-zone/branch breakdown
- [ ] Alert rules: work with new metric columns
- [ ] Simulator: generates branch-level data, injects faults correctly
- [ ] SSE: streams new structured payload format

### Frontend Tests

- [ ] SSE connection parses new payload format
- [ ] Zone grid renders zones with branch summaries
- [ ] Branch cards show inlet/outlet flow with leak indicator
- [ ] Moisture uniformity bar renders 3 sensor values
- [ ] Leak detection panel shows active alerts
- [ ] Water consumption chart shows breakdown
- [ ] i18n: all new strings translated in Arabic and French
- [ ] RTL layout works correctly for new components

### Integration Tests

- [ ] Simulator start → SSE streams data → frontend displays zones and branches
- [ ] Inject leak via API → leak_detected=true in readings → leak alert appears in frontend
- [ ] Create zone + branches via API → simulator picks up new topology
- [ ] Alert rule on `flow_delta_lpm` → triggers when leak occurs

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| More rows per cycle (N branches × 2 tables vs N zones × 1 table) | Tight indexes on `(farm_id, timestamp DESC)` and `(branch_id, timestamp DESC)` |
| Dashboard query complexity (multiple joins) | Cache dashboard in memory, refresh every SSE cycle |
| SSE payload size increase | Send zone summaries by default; branch detail on-demand via API |
| Data retention growth | Add `IOT_DATA_RETENTION_DAYS` cleanup job (daily cron or background task) |
| Migration of existing data | One-time SQL script; keep `iot_readings_legacy` for 30 days |

---

## Rollback Strategy

1. Keep `iot_readings_legacy` table for 30 days after migration
2. Keep legacy `POST /readings` and `POST /readings/batch` endpoints working
3. Old frontend can fall back to polling `/api/iot/readings/latest` if SSE format changes break it
4. If rollback is needed: rename `iot_readings_legacy` back to `iot_readings` and revert code
