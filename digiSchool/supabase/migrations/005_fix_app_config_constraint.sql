-- =============================================================================
-- Clean up app_config and force the Primary Key for ON CONFLICT to work.
-- Run this in your Supabase SQL Editor.
-- =============================================================================

-- 1. Remove the old single-tenant default row which has a NULL school_id
DELETE FROM public.app_config WHERE school_id IS NULL;

-- 2. Remove any duplicate configs for the same school (keeps the most recently updated one)
DELETE FROM public.app_config a
WHERE a.updated_at < (
  SELECT max(updated_at)
  FROM public.app_config b
  WHERE a.school_id = b.school_id
);

-- 3. Force school_id to be NOT NULL
ALTER TABLE public.app_config ALTER COLUMN school_id SET NOT NULL;

-- 4. Drop any existing primary key or unique constraints just in case
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_pkey CASCADE;
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_school_unique CASCADE;
DROP INDEX IF EXISTS app_config_school_unique;

-- 5. Add the definitive Primary Key on school_id
ALTER TABLE public.app_config ADD PRIMARY KEY (school_id);
