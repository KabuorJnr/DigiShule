-- Add guardian details to students table for parent portal linkage

alter table public.students
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_email text;
