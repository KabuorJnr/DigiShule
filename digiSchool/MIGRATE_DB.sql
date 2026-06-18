-- Run this script in the Supabase SQL Editor to add the missing school_id columns to your existing tables

-- 1. Create the schools table if it doesn't exist
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  motto TEXT,
  type TEXT,
  county TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  grade_boundaries JSONB DEFAULT '[]'::jsonb,
  fee_structure JSONB DEFAULT '{}'::jsonb,
  notif_toggles JSONB DEFAULT '{}'::jsonb,
  venues JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add school_id to all existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE timetables ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 3. In case any tables were missing entirely, create them:
CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  exam_id TEXT REFERENCES exam_schedules(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue TEXT,
  invigilator TEXT,
  status TEXT DEFAULT 'Upcoming',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Pending',
  due_date DATE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL,
  ref TEXT,
  date DATE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Pending',
  requested_by TEXT NOT NULL,
  date DATE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure RLS is disabled temporarily so the app works smoothly
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetables DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- 4. Settings RPC
CREATE OR REPLACE FUNCTION upsert_school_config(
  p_school_id UUID,
  p_settings JSONB DEFAULT NULL,
  p_grade_boundaries JSONB DEFAULT NULL,
  p_fee_structure JSONB DEFAULT NULL,
  p_notif_toggles JSONB DEFAULT NULL,
  p_venues JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE schools
  SET
    settings = COALESCE(p_settings, settings),
    grade_boundaries = COALESCE(p_grade_boundaries, grade_boundaries),
    fee_structure = COALESCE(p_fee_structure, fee_structure),
    notif_toggles = COALESCE(p_notif_toggles, notif_toggles),
    venues = COALESCE(p_venues, venues)
  WHERE id = p_school_id;
END;
$$;
