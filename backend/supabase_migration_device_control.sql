-- Device Control Migration
-- Command audit log
CREATE TABLE device_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    device_id UUID REFERENCES iot_devices(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    command_type TEXT NOT NULL,            -- valve_open, valve_close, pump_start, pump_stop, set_override
    target_type TEXT NOT NULL,             -- device, zone, farm
    target_id TEXT NOT NULL,              -- UUID of target
    parameters JSONB DEFAULT '{}',        -- {duration_minutes: 30, override: true}
    source TEXT NOT NULL DEFAULT 'manual', -- manual, auto, ai, schedule
    issued_by UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',-- pending, sent, executed, failed, cancelled
    result JSONB DEFAULT '{}',           -- {previous_state: ..., new_state: ...}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);
CREATE INDEX idx_dc_farm ON device_commands(farm_id);
CREATE INDEX idx_dc_created ON device_commands(created_at DESC);

-- Add control state to devices
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS control_state JSONB DEFAULT '{}';
-- Example: {"valve_open": true, "mode": "manual", "manual_override_until": "2026-03-18T15:00:00Z"}
