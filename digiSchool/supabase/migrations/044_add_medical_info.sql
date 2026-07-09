-- Migration to add medicalInfo to students and admissions tables

ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS "medicalInfo" TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS "medicalInfo" TEXT;
