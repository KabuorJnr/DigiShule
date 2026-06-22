-- Run this script in the Supabase SQL Editor to add the missing columns to the students table.

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS guardian_name TEXT,
ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian_email TEXT,
ADD COLUMN IF NOT EXISTS birth_cert_no TEXT,
ADD COLUMN IF NOT EXISTS parent_address TEXT,
ADD COLUMN IF NOT EXISTS admission_letter_url TEXT;
