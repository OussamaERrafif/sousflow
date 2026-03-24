-- Migration: WhatsApp service improvements
-- 1. Add pending_action + pending_expires_at to whatsapp_ai_sessions (replaces in-memory dict)
-- 2. Add 'disconnected' state support
-- 3. Create whatsapp_alert_log for alert deduplication
-- Run this in Supabase SQL Editor

-- ─── Fix 1 & 2: Persistent confirmations + disconnected state ───────────

ALTER TABLE whatsapp_ai_sessions
  ADD COLUMN IF NOT EXISTS pending_action text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_expires_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN whatsapp_ai_sessions.state IS 'awaiting_farm_name | connected | disconnected';
COMMENT ON COLUMN whatsapp_ai_sessions.pending_action IS 'Pending irrigation action: start | stop | NULL';
COMMENT ON COLUMN whatsapp_ai_sessions.pending_expires_at IS 'Expiry time for pending confirmation (auto-cleared after)';

-- ─── Fix 5: Alert deduplication ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_alert_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone text NOT NULL,
    alert_hash text NOT NULL,
    cooldown_until timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_alert_log_lookup
  ON whatsapp_alert_log(phone, alert_hash);
