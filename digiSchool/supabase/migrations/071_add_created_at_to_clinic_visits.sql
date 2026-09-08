-- Migration: Add missing created_at column to clinic_visits
-- Description: The React frontend expects to log the creation time for the clinic visits log.

ALTER TABLE public.clinic_visits ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
NOTIFY pgrst, 'reload schema';
