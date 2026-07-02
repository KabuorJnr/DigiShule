-- Add NEMIS-related columns to students table

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS nemis_upi text,
ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'Kenyan',
ADD COLUMN IF NOT EXISTS county text,
ADD COLUMN IF NOT EXISTS sub_county text;
