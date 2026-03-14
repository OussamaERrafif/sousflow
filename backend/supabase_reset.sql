-- ============================================
-- SoussFlow — Full Database Reset
-- Wipes ALL data including auth users.
-- Table structure is preserved.
-- Run this in the Supabase SQL Editor.
-- ============================================

-- 1. Clear all app data (respecting FK order)
TRUNCATE TABLE
    chat_messages,
    alert_history,
    alert_rules,
    predictions,
    iot_readings,
    whatsapp_messages,
    farm_memberships,
    conversations,
    farms,
    user_profiles
RESTART IDENTITY CASCADE;

-- 2. Delete all auth users (cascades to user_profiles via FK)
DELETE FROM auth.users;

-- 3. Clean up any orphaned Supabase auth metadata
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.identities;
