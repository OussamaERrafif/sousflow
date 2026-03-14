-- ============================================
-- SoussFlow — Seed superadmin user
-- Run AFTER supabase_schema_v2.sql
-- ============================================
-- Default superadmin credentials:
--   username: admin
--   password: admin123
-- CHANGE THE PASSWORD after first login!
-- ============================================

INSERT INTO users (id, username, password_hash, role, full_name, is_active)
VALUES (
    uuid_generate_v4(),
    'admin',
    -- bcrypt hash of 'admin123'
    crypt('admin123', gen_salt('bf')),
    'superadmin',
    'Super Admin',
    TRUE
)
ON CONFLICT (username) DO NOTHING;
