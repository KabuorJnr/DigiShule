-- Run this in your Supabase SQL Editor to link all orphaned data (from before the multi-tenant update) to your original school.

DO $$
DECLARE
  first_school_id UUID;
BEGIN
  -- Get the oldest school ID (your first/original school)
  SELECT id INTO first_school_id FROM schools ORDER BY created_at ASC LIMIT 1;
  
  IF first_school_id IS NOT NULL THEN
    -- Update all records that are missing a school_id
    UPDATE students SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE teachers SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE exam_schedules SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE timetables SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE notifications SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE events SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE profiles SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE expenses SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE invoices SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE finance_payments SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE staff SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE messages SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE admissions SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE disciplinary_records SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE clinic_visits SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE library_books SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE library_loans SET school_id = first_school_id WHERE school_id IS NULL;
    UPDATE facilities SET school_id = first_school_id WHERE school_id IS NULL;
  END IF;
END $$;
