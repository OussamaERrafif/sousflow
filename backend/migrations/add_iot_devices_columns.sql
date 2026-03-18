-- Migration: Add missing columns to iot_devices table
-- Also adds center_latitude/center_longitude to zones for map support
-- Run this in Supabase SQL Editor

-- iot_devices: add missing columns expected by the backend
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS device_type text NOT NULL DEFAULT 'flow_meter';
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS mac_address text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id);
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS reservoir_id uuid REFERENCES reservoirs(id);
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'online';
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS last_reading_at timestamptz;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS last_battery_pct double precision;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- zones: add center coordinates for map visualization
ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_latitude double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_longitude double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS area_hectares double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS geometry jsonb;

-- If iot_devices table doesn't exist at all, create it
CREATE TABLE IF NOT EXISTS iot_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    device_type text NOT NULL DEFAULT 'flow_meter',
    name text,
    device_id text,
    model text,
    serial_number text,
    mac_address text,
    ip_address text,
    latitude double precision,
    longitude double precision,
    zone_id uuid REFERENCES zones(id),
    reservoir_id uuid REFERENCES reservoirs(id),
    status text NOT NULL DEFAULT 'online',
    last_reading_at timestamptz,
    last_battery_pct double precision,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- If reservoirs table doesn't exist, create it
CREATE TABLE IF NOT EXISTS reservoirs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name text NOT NULL,
    capacity_liters double precision,
    current_level_pct double precision DEFAULT 0,
    latitude double precision,
    longitude double precision,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- If pipes table doesn't exist, create it
CREATE TABLE IF NOT EXISTS pipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name text NOT NULL,
    pipe_type text NOT NULL DEFAULT 'main',
    diameter_mm double precision,
    length_meters double precision,
    from_latitude double precision,
    from_longitude double precision,
    to_latitude double precision,
    to_longitude double precision,
    from_zone_id uuid REFERENCES zones(id),
    to_zone_id uuid REFERENCES zones(id),
    from_reservoir_id uuid REFERENCES reservoirs(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
