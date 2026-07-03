-- 014_consolidated_loose_schema.sql
-- Consolidates all 12 loose SQL files into a single tracked migration

-- 1. Analytics Module Aggregation Functions
CREATE OR REPLACE FUNCTION get_academic_analytics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  WITH subject_scores AS (
    SELECT 
      key AS subject, 
      AVG(value::numeric) AS average_score
    FROM students, jsonb_each_text(scores)
    WHERE school_id = my_school_id()
    GROUP BY key
  ),
  formatted_scores AS (
    SELECT 
      subject as name, 
      ROUND(average_score, 1) as score 
    FROM subject_scores 
    ORDER BY average_score DESC
  )
  SELECT json_build_object(
    'top_subjects', COALESCE((SELECT json_agg(row_to_json(formatted_scores)) FROM formatted_scores), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. SMS Logs Table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  sender_role TEXT,
  recipient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and Policies for sms_logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON sms_logs;
CREATE POLICY "school isolation" ON sms_logs
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 3. Messages Table (if not exists)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  recipient_role TEXT,
  student_name TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'Unread',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Student Attendance Table
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  student_id TEXT NOT NULL,
  adm TEXT NOT NULL,
  class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',
  remarks TEXT,
  recorded_by TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.student_attendance;
CREATE POLICY "school isolation" ON public.student_attendance
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 5. Assignment Submissions Table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  adm TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted',
  grade TEXT,
  feedback TEXT,
  file_url TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.assignment_submissions;
CREATE POLICY "school isolation" ON public.assignment_submissions
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 6. Add Missing Columns to Staff and Other Tables
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS library_books ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS library_loans ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS clinic_visits ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS admissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS disciplinary_records ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS facilities ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

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

DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='staff' and column_name='checkIn')
  THEN
      ALTER TABLE "public"."staff" RENAME COLUMN "checkIn" TO "check_in";
  END IF;
END $$;

ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS subject TEXT;

-- 7. Update Stats RPC
CREATE OR REPLACE FUNCTION get_student_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_active', COUNT(*) FILTER (WHERE status != 'Inactive' AND status != 'Graduated'),
    'male', COUNT(*) FILTER (WHERE gender = 'Male' AND status != 'Inactive' AND status != 'Graduated'),
    'female', COUNT(*) FILTER (WHERE gender = 'Female' AND status != 'Inactive' AND status != 'Graduated'),
    'flagged', COUNT(*) FILTER (WHERE flagged = true AND status != 'Inactive' AND status != 'Graduated')
  ) INTO result
  FROM students
  WHERE school_id = my_school_id();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add Missing Columns to Students Table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS guardian_name TEXT,
ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian_email TEXT,
ADD COLUMN IF NOT EXISTS birth_cert_no TEXT,
ADD COLUMN IF NOT EXISTS parent_address TEXT,
ADD COLUMN IF NOT EXISTS admission_letter_url TEXT;

UPDATE public.students 
SET class = REPLACE(class, 'Grade ', '') 
WHERE class LIKE 'Grade %';

-- 9. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  staff_id TEXT,
  dept TEXT,
  type TEXT NOT NULL DEFAULT 'Annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  approved_by TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.leave_requests;
CREATE POLICY "school isolation" ON public.leave_requests
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 10. Final RLS Enforcement on new tables (if any slipped through)
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN 
        SELECT c.relname 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' 
          AND c.relkind = 'r' 
          AND NOT c.relrowsecurity
          AND c.relname NOT IN ('schema_migrations')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.relname);
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = tbl.relname 
              AND column_name = 'school_id'
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS "school isolation" ON public.%I;', tbl.relname);
            EXECUTE format('
                CREATE POLICY "school isolation" ON public.%I
                FOR ALL USING (school_id = ANY(my_school_ids()))
                WITH CHECK (school_id = ANY(my_school_ids()));
            ', tbl.relname);
        END IF;
    END LOOP;
END $$;
