-- ============================================
-- SoussFlow v3 — Self-managed Auth
-- Farm-scoped database schema
-- No dependency on auth.users — uses public.users table
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- DROP old tables
-- ============================================
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS iot_readings CASCADE;
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS farm_memberships CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS farms CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop old trigger/function if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.can_access_farm(UUID);

-- ============================================
-- 1. Users (self-managed auth)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'farm_employee' CHECK (role IN ('superadmin', 'farm_owner', 'farm_employee')),
    full_name TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. Farms (central entity)
-- ============================================
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    location TEXT,
    total_zones INTEGER DEFAULT 4,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farms_owner ON farms(owner_id);

-- ============================================
-- 3. Farm Memberships (employees)
-- ============================================
CREATE TABLE farm_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{"read": true, "write_readings": true}',
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id)
);

CREATE INDEX idx_fm_farm ON farm_memberships(farm_id);
CREATE INDEX idx_fm_user ON farm_memberships(user_id);

-- ============================================
-- 4. Conversations (chat)
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conv_user ON conversations(user_id);
CREATE INDEX idx_conv_farm ON conversations(farm_id);
CREATE INDEX idx_conv_updated ON conversations(updated_at DESC);

-- ============================================
-- 5. IoT Readings (farm-scoped)
-- ============================================
CREATE TABLE iot_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Time
    timestamp TIMESTAMPTZ NOT NULL,
    month SMALLINT,
    hour SMALLINT,

    -- Zone & Plant
    zone_id INTEGER NOT NULL,
    plant_type TEXT DEFAULT 'olive',
    plant_species TEXT DEFAULT 'Olea europaea',

    -- Environmental sensors
    air_temperature_c DOUBLE PRECISION,
    air_humidity_pct DOUBLE PRECISION,
    air_pressure_hpa DOUBLE PRECISION,
    light_intensity_lux DOUBLE PRECISION,

    -- Water infrastructure
    reservoir_level_pct DOUBLE PRECISION,
    main_pressure_mpa DOUBLE PRECISION,
    filter_status SMALLINT DEFAULT 0,

    -- Zone water (per-zone)
    valve_open SMALLINT DEFAULT 0,
    zone_flow_lpm DOUBLE PRECISION,
    zone_pressure_mpa DOUBLE PRECISION,

    -- Zone soil (per-zone)
    soil_moisture_pct DOUBLE PRECISION,

    -- Weather context
    solar_radiation_wm2 DOUBLE PRECISION,
    precipitation_mm DOUBLE PRECISION,
    wind_speed_kmh DOUBLE PRECISION,
    cloud_cover_pct DOUBLE PRECISION,

    -- Derived / computed
    is_anomaly SMALLINT DEFAULT 0,
    stress_score DOUBLE PRECISION,
    stress_class TEXT,
    health_score DOUBLE PRECISION,
    irrigation_needed SMALLINT DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iot_farm ON iot_readings(farm_id);
CREATE INDEX idx_iot_ts ON iot_readings(timestamp DESC);
CREATE INDEX idx_iot_zone ON iot_readings(zone_id);
CREATE INDEX idx_iot_farm_zone_ts ON iot_readings(farm_id, zone_id, timestamp DESC);
CREATE INDEX idx_iot_farm_ts ON iot_readings(farm_id, timestamp DESC);
CREATE INDEX idx_iot_anomaly ON iot_readings(is_anomaly) WHERE is_anomaly = 1;
CREATE INDEX idx_iot_irrigation ON iot_readings(irrigation_needed) WHERE irrigation_needed = 1;

-- ============================================
-- 6. Predictions (farm-scoped)
-- ============================================
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    prediction_type TEXT NOT NULL,
    target_column TEXT NOT NULL,
    zone_id INTEGER,
    model_used TEXT NOT NULL,
    accuracy_score DOUBLE PRECISION,
    result JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pred_farm ON predictions(farm_id);
CREATE INDEX idx_pred_created ON predictions(created_at DESC);
CREATE INDEX idx_pred_type ON predictions(prediction_type);

-- ============================================
-- 7. Alert Rules (farm-scoped)
-- ============================================
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    target_column TEXT NOT NULL,
    condition TEXT NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    zone_id INTEGER,
    notify_whatsapp BOOLEAN DEFAULT TRUE,
    phone TEXT,
    message_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_farm ON alert_rules(farm_id);

-- ============================================
-- 8. Alert History (farm-scoped)
-- ============================================
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL,
    zone_id INTEGER,
    target_column TEXT,
    value DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    message TEXT,
    sent_via TEXT DEFAULT 'whatsapp',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ah_farm ON alert_history(farm_id);
CREATE INDEX idx_ah_created ON alert_history(created_at DESC);

-- ============================================
-- 9. Chat Messages
-- ============================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cm_conv ON chat_messages(conversation_id);
CREATE INDEX idx_cm_created ON chat_messages(created_at ASC);

-- ============================================
-- 10. WhatsApp Messages
-- ============================================
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'outbound',
    status TEXT DEFAULT 'sent',
    external_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_phone ON whatsapp_messages(phone);
CREATE INDEX idx_wa_created ON whatsapp_messages(created_at DESC);

-- ============================================
-- 11. Zones (with geographic coordinates for map)
-- ============================================
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    zone_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    area_hectares DOUBLE PRECISION,
    geometry JSONB DEFAULT '{}',  -- GeoJSON polygon for zone drawing
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zones_farm ON zones(farm_id);
CREATE UNIQUE INDEX idx_zones_farm_number ON zones(farm_id, zone_number);

-- ============================================
-- 12. Reservoirs (water tanks)
-- ============================================
CREATE TABLE reservoirs (
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

CREATE INDEX idx_reservoirs_farm ON reservoirs(farm_id);

-- ============================================
-- 13. Pipes (distribution network)
-- ============================================
CREATE TABLE pipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pipe_type TEXT DEFAULT 'main',  -- main, secondary, lateral
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

CREATE INDEX idx_pipes_farm ON pipes(farm_id);

-- ============================================
-- 14. IoT Devices
-- ============================================
CREATE TABLE iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL,  -- flow_meter, pressure_sensor, moisture_sensor, valve_controller, gateway
    name TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    mac_address TEXT,
    ip_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    reservoir_id UUID REFERENCES reservoirs(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'offline',  -- online, offline, error, maintenance
    last_reading_at TIMESTAMPTZ,
    last_battery_pct DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iot_devices_farm ON iot_devices(farm_id);
CREATE INDEX idx_iot_devices_zone ON iot_devices(zone_id);
CREATE INDEX idx_iot_devices_status ON iot_devices(status);

-- ============================================
-- 15. Branches (within zones)
-- ============================================
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    branch_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    length_meters DOUBLE PRECISION,
    emitter_count INTEGER,
    emitter_flow_lph DOUBLE PRECISION,
    geometry JSONB DEFAULT '{}',  -- GeoJSON line for branch path
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_zone ON branches(zone_id);
CREATE UNIQUE INDEX idx_branches_zone_number ON branches(zone_id, branch_number);

-- ============================================
-- No RLS needed — all access control is handled
-- in the backend using service_role key.
-- ============================================
