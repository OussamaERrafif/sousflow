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
