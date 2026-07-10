-- 052_user_profiles.sql
-- Add TSC number and bio to teachers table

-- Add columns to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS tsc_number TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS bio TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
