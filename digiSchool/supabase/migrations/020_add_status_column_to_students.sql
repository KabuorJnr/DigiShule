-- 020_add_status_column_to_students.sql
-- Add the missing 'status' column to the students table to support enrollment and stats

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
