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
    '00000000-0000-0000-0000-000000000001',
    'admin',
    -- bcrypt hash of 'admin123' (generated with Python passlib)
    '$2b$12$CZNtkpQsUHa3P2uuXSvsF.br5YlsTF8aMTnzHAFRg/VcynA79e7xe',
    'superadmin',
    'Super Admin',
    TRUE
)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
