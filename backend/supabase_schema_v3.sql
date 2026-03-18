-- ============================================================
-- SoussFlow IoT Schema v3 — Hierarchical Zone/Branch Model
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
-- Add a CHECK constraint on target_column to validate allowed metric names.
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_target_column_check;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_target_column_check CHECK (
    target_column IN (
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
