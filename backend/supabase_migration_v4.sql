-- SoussFlow Migration v4 — Anomaly Detection System Extension
-- Adds: anomaly_types catalog, sensor_baselines, farm_health_snapshots
-- Extends: anomaly_events with confidence_score, detection_method, etc.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Anomaly Type Catalog
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_types (
    code TEXT PRIMARY KEY,
    domain TEXT NOT NULL CHECK (domain IN ('hydraulic', 'agronomic', 'equipment', 'data')),
    display_name TEXT NOT NULL,
    description TEXT,
    default_severity TEXT NOT NULL CHECK (default_severity IN ('low', 'medium', 'high', 'critical')),
    recommended_action TEXT,
    documentation_url TEXT
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Extend anomaly_events (all nullable to avoid breaking existing rows)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE anomaly_events
    ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS baseline_value FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS actual_value FLOAT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS false_positive BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Statistical Baselines
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sensor_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    window_hours INTEGER NOT NULL DEFAULT 168,
    mean FLOAT NOT NULL,
    std_dev FLOAT NOT NULL,
    min_val FLOAT NOT NULL,
    max_val FLOAT NOT NULL,
    p5 FLOAT,
    p95 FLOAT,
    sample_count INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(farm_id, zone_id, branch_id, column_name, window_hours)
);

CREATE INDEX IF NOT EXISTS idx_baselines_lookup ON sensor_baselines (farm_id, column_name) WHERE zone_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_baselines_zone ON sensor_baselines (farm_id, zone_id, column_name);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Farm Health Snapshots
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farm_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hydraulic_health_score FLOAT,
    agronomic_health_score FLOAT,
    equipment_health_score FLOAT,
    data_quality_score FLOAT,
    overall_score FLOAT,
    active_anomalies_critical INTEGER DEFAULT 0,
    active_anomalies_high INTEGER DEFAULT 0,
    active_anomalies_medium INTEGER DEFAULT 0,
    active_anomalies_low INTEGER DEFAULT 0,
    water_efficiency_avg FLOAT,
    zones_at_risk UUID[],
    UNIQUE(farm_id, DATE_TRUNC('hour', snapshot_at))
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_farm ON farm_health_snapshots (farm_id, snapshot_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 5. Seed anomaly_types catalog (32 types across 4 domains)
-- ─────────────────────────────────────────────────────────────────────

-- HYDRAULIC (11)
INSERT INTO anomaly_types (code, domain, display_name, description, default_severity, recommended_action) VALUES
('LEAK_BRANCH',           'hydraulic', 'Branch Leak',               'Inlet flow significantly exceeds outlet flow on a branch',              'high',     'Inspect branch pipes and drip lines for visible damage'),
('LEAK_ZONE',             'hydraulic', 'Zone Leak',                  'Zone total inlet exceeds total outlet across multiple branches',         'high',     'Shut down zone and perform pressure test'),
('PIPE_BURST',            'hydraulic', 'Pipe Burst',                 'Sudden extreme flow spike combined with severe pressure drop',           'critical', 'Immediately stop pump and locate burst point'),
('DRIPPER_CLOG_PARTIAL',  'hydraulic', 'Partial Dripper Clog',       'Flow delta rising trend with low uniformity coefficient',               'medium',   'Flush lines and inspect dripper emitters'),
('DRIPPER_CLOG_SEVERE',   'hydraulic', 'Severe Dripper Clog',        'Outlet flow near zero while inlet pressure is normal',                  'high',     'Replace clogged drippers and flush mainline'),
('FILTER_CLOG_EARLY',     'hydraulic', 'Filter Clog — Early Stage',  'Inlet pressure rising while pump flow is declining',                    'medium',   'Schedule filter cleaning or backwash'),
('FILTER_CLOG_CRITICAL',  'hydraulic', 'Filter Clog — Critical',     'Pressure differential across filter exceeds safe threshold',            'critical', 'Stop irrigation and clean/replace filter immediately'),
('VALVE_STUCK_OPEN',      'hydraulic', 'Valve Stuck Open',           'Flow detected when zone should be off per schedule',                    'high',     'Manually close valve and inspect solenoid'),
('VALVE_STUCK_CLOSED',    'hydraulic', 'Valve Stuck Closed',         'No flow when zone is active in irrigation schedule',                    'high',     'Check solenoid wiring and valve seat'),
('PRESSURE_ANOMALY_LOW',  'hydraulic', 'Low System Pressure',        'Main pipeline pressure below minimum operating threshold',              'high',     'Check pump output and look for upstream leaks'),
('PRESSURE_ANOMALY_HIGH', 'hydraulic', 'High System Pressure',       'Main pipeline pressure above maximum safe operating level',             'high',     'Check pressure regulator and reduce pump speed')
ON CONFLICT (code) DO NOTHING;

-- AGRONOMIC (7)
INSERT INTO anomaly_types (code, domain, display_name, description, default_severity, recommended_action) VALUES
('OVER_IRRIGATION',      'agronomic', 'Over-Irrigation',        'Soil moisture well above target while zone is actively irrigating',     'low',    'Reduce irrigation duration or increase interval'),
('UNDER_IRRIGATION',     'agronomic', 'Under-Irrigation',       'Soil moisture below target and zone has been inactive too long',        'medium', 'Check schedule and extend irrigation run time'),
('UNEVEN_ZONE',          'agronomic', 'Uneven Water Distribution', 'Uniformity coefficient below acceptable threshold',                  'medium', 'Inspect emitters for clogs or damage'),
('WATERLOGGING_RISK',    'agronomic', 'Waterlogging Risk',       'Moisture at end of drip line much higher than at start — pooling',     'medium', 'Check slope drainage and reduce tail-end flow'),
('ROOT_ZONE_DRY',        'agronomic', 'Root Zone Dry',           'Middle moisture sensors reading low while edge sensors are adequate',   'medium', 'Verify dripper placement relative to tree canopy'),
('STRESS_SPIKE',         'agronomic', 'Plant Stress Spike',      'Stress score jumps suddenly without corresponding temperature cause',   'high',   'Inspect system for blockage or scheduling error'),
('YIELD_RISK_HEAT',      'agronomic', 'Yield Risk — Heat Stress','Sustained high temperature combined with elevated plant stress score', 'high',   'Increase irrigation frequency during heat events')
ON CONFLICT (code) DO NOTHING;

-- EQUIPMENT (6)
INSERT INTO anomaly_types (code, domain, display_name, description, default_severity, recommended_action) VALUES
('PUMP_DEGRADATION',           'equipment', 'Pump Degradation',            'Pump flow output declining trend across multiple sessions',          'medium',   'Schedule pump maintenance and check impeller'),
('PUMP_FAILURE_IMMINENT',      'equipment', 'Pump Failure Imminent',       'Both flow and pressure simultaneously declining over 30 minutes',    'critical', 'Stop pump immediately and call maintenance'),
('PUMP_CAVITATION',            'equipment', 'Pump Cavitation',             'Pressure oscillation pattern indicating cavitation',                 'high',     'Check inlet filter and priming — reduce pump speed'),
('RESERVOIR_CRITICAL',         'equipment', 'Reservoir Level Critical',    'Reservoir level below critical operational threshold',               'critical', 'Stop irrigation and check water supply'),
('RESERVOIR_LEAK',             'equipment', 'Reservoir Leak',              'Level drops when no irrigation zones are active',                    'high',     'Inspect reservoir walls, outlet valves, and overflow'),
('SENSOR_COMMUNICATION_LOSS',  'equipment', 'Sensor Communication Loss',   'Missing data from sensor for N consecutive intervals',               'medium',   'Check sensor power and network connectivity')
ON CONFLICT (code) DO NOTHING;

-- DATA (8)
INSERT INTO anomaly_types (code, domain, display_name, description, default_severity, recommended_action) VALUES
('SENSOR_FROZEN',        'data', 'Sensor Frozen',          'Sensor reporting identical values for multiple consecutive readings',   'medium', 'Restart sensor or check for firmware hang'),
('SENSOR_DRIFT',         'data', 'Sensor Drift',           'Slow systematic drift from established baseline value',                 'low',    'Recalibrate sensor against reference measurement'),
('IMPOSSIBLE_VALUE',     'data', 'Impossible Reading',     'Sensor value outside physical bounds for this measurement type',        'medium', 'Check sensor wiring and calibration settings'),
('MISSING_DATA',         'data', 'Missing Data',           'Gap detected in time-series data',                                      'low',    'Verify sensor connectivity and data pipeline'),
('CROSS_SENSOR_CONFLICT','data', 'Cross-Sensor Conflict',  'Logically impossible combination of readings (e.g., moisture high + flow zero)', 'high', 'Verify both sensors independently and check field conditions'),
('CLOCK_DRIFT',          'data', 'Clock Drift',            'Timestamp anomaly vs server time — sensor clock out of sync',           'low',    'Sync sensor RTC with NTP server'),
('z_score',              'data', 'Statistical Outlier (Z-Score)', 'Reading deviates significantly from statistical baseline',        'medium', 'Review raw data and verify sensor accuracy'),
('sudden_change',        'data', 'Sudden Change',          'Abnormally large change from previous reading',                         'medium', 'Verify reading and check for external disturbance'),
('stuck_sensor',         'data', 'Stuck Sensor',           'Sensor reporting near-identical values — likely frozen or failed',      'medium', 'Restart or replace sensor'),
('drift',                'data', 'Sensor Drift (Statistical)', 'Recent average diverges from long-term average',                   'low',    'Recalibrate sensor'),
('correlation',          'data', 'Correlated Anomaly',     'Multiple sensors show related anomalies suggesting a systemic issue',  'high',   'Investigate compound fault across sensors'),
('injected',             'data', 'Manual Alert',           'Manually injected test or diagnostic alert',                           'medium', 'This is a manually created alert — review and acknowledge')
ON CONFLICT (code) DO NOTHING;
