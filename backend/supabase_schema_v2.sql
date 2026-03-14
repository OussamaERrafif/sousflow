-- ============================================
-- SoussFlow v2 — Multi-Role & Chat Overhaul
-- Farm-scoped database schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP old v1 tables (safe — they will be recreated below)
-- chat_messages first (FK depends on nothing yet in v2)
-- then the tables that had user_id → farm_id change
-- New tables (user_profiles, farms, farm_memberships, conversations)
-- are created fresh and don't need dropping.
-- ============================================
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS iot_readings CASCADE;

-- ============================================
-- 1. User Profiles (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'farm_owner' CHECK (role IN ('farm_owner', 'farm_employee')),
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create user profile on signup (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, role, full_name)
    VALUES (NEW.id, 'farm_owner', NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. Farms (central entity)
-- ============================================
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    location TEXT,
    total_zones INTEGER DEFAULT 4,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms(owner_id);

-- ============================================
-- 3. Farm Memberships (employees)
-- ============================================
CREATE TABLE IF NOT EXISTS farm_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{"read": true, "write_readings": true}',
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_farm ON farm_memberships(farm_id);
CREATE INDEX IF NOT EXISTS idx_fm_user ON farm_memberships(user_id);

-- ============================================
-- 4. Conversations (chat)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_farm ON conversations(farm_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);

-- ============================================
-- 5. IoT Readings (farm-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS iot_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Time
    timestamp TIMESTAMPTZ NOT NULL,
    month SMALLINT,
    hour SMALLINT,

    -- Zone & Plant
    zone_id INTEGER NOT NULL,
    plant_type TEXT DEFAULT 'olive',
    plant_species TEXT DEFAULT 'Olea europaea',

    -- Environmental sensors (BME280, DHT11, BH1750) — shared
    air_temperature_c DOUBLE PRECISION,
    air_humidity_pct DOUBLE PRECISION,
    air_pressure_hpa DOUBLE PRECISION,
    light_intensity_lux DOUBLE PRECISION,

    -- Water infrastructure — shared
    reservoir_level_pct DOUBLE PRECISION,
    main_pressure_mpa DOUBLE PRECISION,
    filter_status SMALLINT DEFAULT 0,

    -- Zone water (per-zone)
    valve_open SMALLINT DEFAULT 0,
    zone_flow_lpm DOUBLE PRECISION,
    zone_pressure_mpa DOUBLE PRECISION,

    -- Zone soil (per-zone)
    soil_moisture_pct DOUBLE PRECISION,

    -- Weather context (Open-Meteo) — shared
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_iot_farm ON iot_readings(farm_id);
CREATE INDEX IF NOT EXISTS idx_iot_ts ON iot_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_zone ON iot_readings(zone_id);
CREATE INDEX IF NOT EXISTS idx_iot_farm_zone_ts ON iot_readings(farm_id, zone_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_farm_ts ON iot_readings(farm_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_anomaly ON iot_readings(is_anomaly) WHERE is_anomaly = 1;
CREATE INDEX IF NOT EXISTS idx_iot_irrigation ON iot_readings(irrigation_needed) WHERE irrigation_needed = 1;

-- ============================================
-- 6. Predictions (farm-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    prediction_type TEXT NOT NULL,
    target_column TEXT NOT NULL,
    zone_id INTEGER,
    model_used TEXT NOT NULL,
    accuracy_score DOUBLE PRECISION,
    result JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pred_farm ON predictions(farm_id);
CREATE INDEX IF NOT EXISTS idx_pred_created ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pred_type ON predictions(prediction_type);

-- ============================================
-- 7. Alert Rules (farm-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_ar_farm ON alert_rules(farm_id);

-- ============================================
-- 8. Alert History (farm-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_history (
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

CREATE INDEX IF NOT EXISTS idx_ah_farm ON alert_history(farm_id);
CREATE INDEX IF NOT EXISTS idx_ah_created ON alert_history(created_at DESC);

-- ============================================
-- 9. Chat Messages (proper FK to conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_conv ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cm_created ON chat_messages(created_at ASC);

-- ============================================
-- 10. WhatsApp Messages (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'outbound',
    status TEXT DEFAULT 'sent',
    external_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_wa_created ON whatsapp_messages(created_at DESC);

-- ============================================
-- Helper Function: can_access_farm
-- ============================================
CREATE OR REPLACE FUNCTION public.can_access_farm(farm_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM farms WHERE id = farm_uuid AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM farm_memberships
    WHERE farm_id = farm_uuid AND user_id = auth.uid() AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- whatsapp_messages: RLS intentionally NOT enabled.
-- Accessed only via service_role key from the backend. No direct client access.

-- user_profiles policies
DROP POLICY IF EXISTS "own_profile_select" ON user_profiles;
DROP POLICY IF EXISTS "own_profile_update" ON user_profiles;
CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE USING (id = auth.uid());

-- farms policies
DROP POLICY IF EXISTS "farms_select" ON farms;
DROP POLICY IF EXISTS "farms_insert" ON farms;
DROP POLICY IF EXISTS "farms_update" ON farms;
DROP POLICY IF EXISTS "farms_delete" ON farms;
CREATE POLICY "farms_select" ON farms FOR SELECT USING (public.can_access_farm(id));
CREATE POLICY "farms_insert" ON farms FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "farms_update" ON farms FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "farms_delete" ON farms FOR DELETE USING (owner_id = auth.uid());

-- farm_memberships policies
DROP POLICY IF EXISTS "memberships_select" ON farm_memberships;
DROP POLICY IF EXISTS "memberships_insert" ON farm_memberships;
DROP POLICY IF EXISTS "memberships_update" ON farm_memberships;
DROP POLICY IF EXISTS "memberships_delete" ON farm_memberships;
CREATE POLICY "memberships_select" ON farm_memberships FOR SELECT USING (public.can_access_farm(farm_id));
CREATE POLICY "memberships_insert" ON farm_memberships FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);
CREATE POLICY "memberships_update" ON farm_memberships FOR UPDATE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);
CREATE POLICY "memberships_delete" ON farm_memberships FOR DELETE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);

-- conversations policies
DROP POLICY IF EXISTS "own_conversations_select" ON conversations;
DROP POLICY IF EXISTS "own_conversations_insert" ON conversations;
DROP POLICY IF EXISTS "own_conversations_update" ON conversations;
DROP POLICY IF EXISTS "own_conversations_delete" ON conversations;
CREATE POLICY "own_conversations_select" ON conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_conversations_insert" ON conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_conversations_update" ON conversations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_conversations_delete" ON conversations FOR DELETE USING (user_id = auth.uid());

-- iot_readings policies
DROP POLICY IF EXISTS "iot_readings_select" ON iot_readings;
DROP POLICY IF EXISTS "iot_readings_insert" ON iot_readings;
CREATE POLICY "iot_readings_select" ON iot_readings FOR SELECT USING (public.can_access_farm(farm_id));
CREATE POLICY "iot_readings_insert" ON iot_readings FOR INSERT WITH CHECK (public.can_access_farm(farm_id));

-- predictions policies
DROP POLICY IF EXISTS "predictions_select" ON predictions;
DROP POLICY IF EXISTS "predictions_insert" ON predictions;
CREATE POLICY "predictions_select" ON predictions FOR SELECT USING (public.can_access_farm(farm_id));
CREATE POLICY "predictions_insert" ON predictions FOR INSERT WITH CHECK (public.can_access_farm(farm_id));

-- alert_rules policies
DROP POLICY IF EXISTS "alert_rules_select" ON alert_rules;
DROP POLICY IF EXISTS "alert_rules_insert" ON alert_rules;
DROP POLICY IF EXISTS "alert_rules_update" ON alert_rules;
DROP POLICY IF EXISTS "alert_rules_delete" ON alert_rules;
CREATE POLICY "alert_rules_select" ON alert_rules FOR SELECT USING (public.can_access_farm(farm_id));
CREATE POLICY "alert_rules_insert" ON alert_rules FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);
CREATE POLICY "alert_rules_update" ON alert_rules FOR UPDATE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);
CREATE POLICY "alert_rules_delete" ON alert_rules FOR DELETE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
);

-- alert_history policies
DROP POLICY IF EXISTS "alert_history_select" ON alert_history;
DROP POLICY IF EXISTS "alert_history_insert" ON alert_history;
CREATE POLICY "alert_history_select" ON alert_history FOR SELECT USING (public.can_access_farm(farm_id));
CREATE POLICY "alert_history_insert" ON alert_history FOR INSERT WITH CHECK (public.can_access_farm(farm_id));

-- chat_messages policies
DROP POLICY IF EXISTS "own_chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "own_chat_messages_insert" ON chat_messages;
CREATE POLICY "own_chat_messages_select" ON chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "own_chat_messages_insert" ON chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
);

-- whatsapp_messages: no RLS (service-role only)

-- ============================================
-- Migration: Create farms for existing users
-- ============================================
-- This script creates a farm for each existing user
-- Run this separately if migrating from single-user to multi-farm

/*
-- Uncomment to run migration:
INSERT INTO farms (owner_id, name, location, total_zones)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'full_name', 'My Farm') || '''s Farm',
    'Agadir, Morocco',
    4
FROM auth.users
ON CONFLICT DO NOTHING;
*/
