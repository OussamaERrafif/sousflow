-- ============================================
-- SoussFlow — Supabase Database Schema
-- Olive Irrigation IoT Platform (Agadir, Morocco)
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. IoT Sensor Readings (main time-series table)
--    Maps directly to the CSV columns from the
--    olive_agadir_2020_2024 dataset
-- ============================================
CREATE TABLE IF NOT EXISTS iot_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

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
    filter_status SMALLINT DEFAULT 0,       -- 0=clean, 1=partial, 2=clogged

    -- Zone water (per-zone)
    valve_open SMALLINT DEFAULT 0,          -- 0=closed, 1=open
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
    is_anomaly SMALLINT DEFAULT 0,          -- 0/1
    stress_score DOUBLE PRECISION,          -- 0.0 to 1.0
    stress_class TEXT,                       -- none/mild/moderate/severe
    health_score DOUBLE PRECISION,          -- 0.0 to 10.0
    irrigation_needed SMALLINT DEFAULT 0,   -- 0/1

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_iot_user ON iot_readings(user_id);
CREATE INDEX idx_iot_ts ON iot_readings(timestamp DESC);
CREATE INDEX idx_iot_zone ON iot_readings(zone_id);
CREATE INDEX idx_iot_user_zone_ts ON iot_readings(user_id, zone_id, timestamp DESC);
CREATE INDEX idx_iot_user_ts ON iot_readings(user_id, timestamp DESC);
CREATE INDEX idx_iot_anomaly ON iot_readings(is_anomaly) WHERE is_anomaly = 1;
CREATE INDEX idx_iot_irrigation ON iot_readings(irrigation_needed) WHERE irrigation_needed = 1;

-- ============================================
-- 2. Predictions
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL,           -- forecast, anomaly, irrigation
    target_column TEXT NOT NULL,             -- e.g. soil_moisture_pct, air_temperature_c
    zone_id INTEGER,
    model_used TEXT NOT NULL,
    accuracy_score DOUBLE PRECISION,
    result JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pred_user ON predictions(user_id);
CREATE INDEX idx_pred_created ON predictions(created_at DESC);
CREATE INDEX idx_pred_type ON predictions(prediction_type);

-- ============================================
-- 3. WhatsApp Messages Log
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

CREATE INDEX idx_wa_phone ON whatsapp_messages(phone);
CREATE INDEX idx_wa_created ON whatsapp_messages(created_at DESC);

-- ============================================
-- 4. Chat Messages (OpenAI conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_conv ON chat_messages(conversation_id);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at ASC);

-- ============================================
-- 5. Alert Rules & History
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_column TEXT NOT NULL,             -- e.g. soil_moisture_pct
    condition TEXT NOT NULL,                 -- above, below, equals
    threshold DOUBLE PRECISION NOT NULL,
    zone_id INTEGER,                         -- NULL = all zones
    notify_whatsapp BOOLEAN DEFAULT TRUE,
    phone TEXT,
    message_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_ar_user ON alert_rules(user_id);
CREATE INDEX idx_ah_user ON alert_history(user_id);
CREATE INDEX idx_ah_created ON alert_history(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- iot_readings
CREATE POLICY "Users own iot_readings SELECT" ON iot_readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own iot_readings INSERT" ON iot_readings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- predictions
CREATE POLICY "Users own predictions SELECT" ON predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own predictions INSERT" ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "Users own chat SELECT" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own chat INSERT" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- alert_rules
CREATE POLICY "Users own rules SELECT" ON alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own rules INSERT" ON alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own rules UPDATE" ON alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users own rules DELETE" ON alert_rules FOR DELETE USING (auth.uid() = user_id);

-- alert_history
CREATE POLICY "Users own alerts SELECT" ON alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own alerts INSERT" ON alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own alerts UPDATE" ON alert_history FOR UPDATE USING (auth.uid() = user_id);

-- whatsapp_messages: no RLS (service-role only, server-side)
