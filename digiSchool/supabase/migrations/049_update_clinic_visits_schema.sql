-- 049_update_clinic_visits_schema.sql
-- Add missing columns to clinic_visits table

ALTER TABLE public.clinic_visits
ADD COLUMN IF NOT EXISTS student_id TEXT,
ADD COLUMN IF NOT EXISTS adm TEXT,
ADD COLUMN IF NOT EXISTS student TEXT,
ADD COLUMN IF NOT EXISTS complaint TEXT,
ADD COLUMN IF NOT EXISTS treatment TEXT,
ADD COLUMN IF NOT EXISTS outcome TEXT,
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS nurse_notes TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
