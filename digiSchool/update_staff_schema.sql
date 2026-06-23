-- Run this in your Supabase SQL Editor to ensure all recent tables have the school_id column

ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS library_books ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS library_loans ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS clinic_visits ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS admissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS disciplinary_records ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS facilities ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- If the staff table doesn't exist at all, create it properly
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  dept TEXT,
  status TEXT,
  check_in TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- If it exists but has the wrong column name, rename it
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='staff' and column_name='checkIn')
  THEN
      ALTER TABLE "public"."staff" RENAME COLUMN "checkIn" TO "check_in";
  END IF;
END $$;
