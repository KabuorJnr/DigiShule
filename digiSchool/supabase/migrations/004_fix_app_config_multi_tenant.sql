-- =============================================================================
-- Fix app_config to properly support multi-tenancy.
-- Run this in your Supabase SQL Editor.
-- =============================================================================

-- 1. Add the school_id column if it does not exist
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 2. Drop the restrictive id column and its check constraints
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_pkey CASCADE;
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_id_check CASCADE;
ALTER TABLE public.app_config DROP COLUMN IF EXISTS id CASCADE;

-- 3. Ensure we have a unique constraint/primary key on school_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'app_config_pkey'
    ) THEN
        ALTER TABLE public.app_config ADD PRIMARY KEY (school_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if it already exists or fails
END $$;

-- 4. Re-apply the isolation policy
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.app_config;
CREATE POLICY "school isolation" ON public.app_config
  FOR ALL USING (school_id = public.my_school_id())
  WITH CHECK (school_id = public.my_school_id());
