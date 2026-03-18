-- Create missing infrastructure tables for SoussFlow

-- Create reservoirs table if not exists
CREATE TABLE IF NOT EXISTS reservoirs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity_liters DOUBLE PRECISION DEFAULT 100000,
    current_level_pct DOUBLE PRECISION DEFAULT 100,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservoirs_farm ON reservoirs(farm_id);

-- Create pipes table if not exists  
CREATE TABLE IF NOT EXISTS pipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pipe_type TEXT DEFAULT 'main',
    diameter_mm DOUBLE PRECISION,
    length_meters DOUBLE PRECISION,
    from_latitude DOUBLE PRECISION,
    from_longitude DOUBLE PRECISION,
    to_latitude DOUBLE PRECISION,
    to_longitude DOUBLE PRECISION,
    from_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    to_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    from_reservoir_id UUID REFERENCES reservoirs(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipes_farm ON pipes(farm_id);

-- Create iot_devices table if not exists
CREATE TABLE IF NOT EXISTS iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL,
    device_id TEXT,
    name TEXT,
    status TEXT DEFAULT 'active',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_farm ON iot_devices(farm_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_zone ON iot_devices(zone_id);

-- Create pumps table if not exists
CREATE TABLE IF NOT EXISTS pumps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pump_type TEXT DEFAULT 'centrifugal',
    flow_rate_lph DOUBLE PRECISION,
    power_kw DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    reservoir_id UUID REFERENCES reservoirs(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pumps_farm ON pumps(farm_id);
