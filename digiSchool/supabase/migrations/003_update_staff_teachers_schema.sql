-- =============================================================================
-- Add missing columns to the teachers table used during staff onboarding
-- Run this in your Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS emp_id TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher';
