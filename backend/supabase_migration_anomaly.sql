-- Anomaly Detection Migration
CREATE TABLE anomaly_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id),
    branch_id UUID REFERENCES branches(id),
    anomaly_type TEXT NOT NULL,           -- sudden_change, stuck_sensor, drift, correlation, z_score
    severity TEXT NOT NULL DEFAULT 'low', -- low, medium, high, critical
    target_columns TEXT[] NOT NULL,       -- e.g. ARRAY['soil_moisture_pct', 'zone_flow_lpm']
    details JSONB NOT NULL DEFAULT '{}', -- {z_score: 3.5, value: 85, mean: 42, std: 12}
    correlated_anomalies UUID[],         -- links to other anomaly_events
    auto_alert_sent BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_ae_farm_created ON anomaly_events(farm_id, created_at DESC);
CREATE INDEX idx_ae_unacked ON anomaly_events(farm_id, acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX idx_ae_severity ON anomaly_events(farm_id, severity);
