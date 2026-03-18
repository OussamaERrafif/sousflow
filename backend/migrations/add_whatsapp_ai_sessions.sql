-- Migration: Create whatsapp_ai_sessions table for WhatsApp AI assistant
-- Tracks per-phone conversation state (farm connection + conversation memory)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_ai_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL UNIQUE,
    state text NOT NULL DEFAULT 'awaiting_farm_name',  -- awaiting_farm_name | connected
    farm_id uuid REFERENCES farms(id) ON DELETE SET NULL,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by phone
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_sessions_phone ON whatsapp_ai_sessions(phone);

-- Allow conversations table to have nullable user_id (for WhatsApp-initiated conversations)
ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL;
