-- Add missing columns to the admissions table for full registration data
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "parentName" TEXT;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "parentPhone" TEXT;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "parentEmail" TEXT;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "boardingStatus" TEXT;

-- Add student_id to messages table so parent messages can reference the student
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS student_id TEXT;
