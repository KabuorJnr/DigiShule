-- 018_fix_profiles_enum_and_school_id.sql
-- Fix the role enum constraint and backfill missing school_ids for auto-healed users

-- 1. Convert the 'role' column from the strict 'app_role' enum to plain text
ALTER TABLE public.profiles ALTER COLUMN role TYPE text;

-- 2. Backfill any profiles that were created via "auto-heal" and are missing a school_id
-- (We assign them to the primary school in the system)
UPDATE public.profiles
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;
