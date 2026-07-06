-- 026_add_missing_roles.sql
-- Add missing application roles to the app_role ENUM type.

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'deputy_academics';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'deputy_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'bursar';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'registrar';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'librarian';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'clinic';
