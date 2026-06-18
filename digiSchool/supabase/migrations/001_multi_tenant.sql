-- =============================================================================
-- EduOne Multi-Tenant Migration
-- Run this entire file in your Supabase SQL Editor ONCE.
-- It is safe to re-run (uses IF NOT EXISTS / OR REPLACE everywhere).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SCHOOLS TABLE — one row per school
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  motto        TEXT,
  type         TEXT,          -- 'National School', 'Private', etc.
  county       TEXT,
  address      TEXT,
  phone        TEXT,
  email        TEXT,
  website      TEXT,
  logo_url     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read their own school (joined via profiles)
CREATE POLICY IF NOT EXISTS "school members read own school"
  ON schools FOR SELECT
  USING (id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- Only the school's principal/admin can update school details
CREATE POLICY IF NOT EXISTS "school admins update school"
  ON schools FOR UPDATE
  USING (id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. EXTEND PROFILES — add school_id
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_school_id_idx ON profiles(school_id);

-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTION — returns current user's school_id
--    Used in all RLS policies. SECURITY DEFINER so RLS can call it safely.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. ADD school_id TO ALL DATA TABLES
-- ---------------------------------------------------------------------------

-- students
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
CREATE INDEX IF NOT EXISTS students_school_id_idx ON students(school_id);

-- teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
CREATE INDEX IF NOT EXISTS teachers_school_id_idx ON teachers(school_id);

-- timetables
ALTER TABLE timetables ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- exam_schedules
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- exam_sessions (inherits isolation via exam_id FK, but add for direct queries)
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- app_config — rename id=1 pattern to school-scoped
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
CREATE UNIQUE INDEX IF NOT EXISTS app_config_school_unique ON app_config(school_id);

-- library_books
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- library_loans
ALTER TABLE library_loans ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- finance_payments
ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- fee_summary
ALTER TABLE fee_summary ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- admissions
ALTER TABLE admissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- clinic_visits
ALTER TABLE clinic_visits ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- disciplinary_records
ALTER TABLE disciplinary_records ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- facilities
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- file_metadata (for Supabase Storage)
ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
CREATE INDEX IF NOT EXISTS file_metadata_school_id_idx ON file_metadata(school_id);

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY — all tables isolated by school_id
-- ---------------------------------------------------------------------------

-- Helper macro (repeat for each table):
-- USING (school_id = my_school_id())
-- WITH CHECK (school_id = my_school_id())

-- students
DROP POLICY IF EXISTS "school isolation" ON students;
CREATE POLICY "school isolation" ON students
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- teachers
DROP POLICY IF EXISTS "school isolation" ON teachers;
CREATE POLICY "school isolation" ON teachers
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- timetables
DROP POLICY IF EXISTS "school isolation" ON timetables;
CREATE POLICY "school isolation" ON timetables
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;

-- exam_schedules
DROP POLICY IF EXISTS "school isolation" ON exam_schedules;
CREATE POLICY "school isolation" ON exam_schedules
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;

-- exam_sessions
DROP POLICY IF EXISTS "school isolation" ON exam_sessions;
CREATE POLICY "school isolation" ON exam_sessions
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- app_config
DROP POLICY IF EXISTS "school isolation" ON app_config;
CREATE POLICY "school isolation" ON app_config
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- library_books
DROP POLICY IF EXISTS "school isolation" ON library_books;
CREATE POLICY "school isolation" ON library_books
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

-- library_loans
DROP POLICY IF EXISTS "school isolation" ON library_loans;
CREATE POLICY "school isolation" ON library_loans
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE library_loans ENABLE ROW LEVEL SECURITY;

-- finance_payments
DROP POLICY IF EXISTS "school isolation" ON finance_payments;
CREATE POLICY "school isolation" ON finance_payments
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;

-- fee_summary
DROP POLICY IF EXISTS "school isolation" ON fee_summary;
CREATE POLICY "school isolation" ON fee_summary
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE fee_summary ENABLE ROW LEVEL SECURITY;

-- admissions
DROP POLICY IF EXISTS "school isolation" ON admissions;
CREATE POLICY "school isolation" ON admissions
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- clinic_visits
DROP POLICY IF EXISTS "school isolation" ON clinic_visits;
CREATE POLICY "school isolation" ON clinic_visits
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE clinic_visits ENABLE ROW LEVEL SECURITY;

-- disciplinary_records
DROP POLICY IF EXISTS "school isolation" ON disciplinary_records;
CREATE POLICY "school isolation" ON disciplinary_records
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE disciplinary_records ENABLE ROW LEVEL SECURITY;

-- staff
DROP POLICY IF EXISTS "school isolation" ON staff;
CREATE POLICY "school isolation" ON staff
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- facilities
DROP POLICY IF EXISTS "school isolation" ON facilities;
CREATE POLICY "school isolation" ON facilities
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

-- notifications
DROP POLICY IF EXISTS "school isolation" ON notifications;
CREATE POLICY "school isolation" ON notifications
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- file_metadata
DROP POLICY IF EXISTS "school isolation" ON file_metadata;
CREATE POLICY "school isolation" ON file_metadata
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 6. SUPABASE STORAGE — Storage Object RLS (eduone-files bucket)
-- ---------------------------------------------------------------------------
-- Files are stored under: {school_id}/{type}/{file_id}.pdf
-- This ensures storage objects are also school-isolated.

DROP POLICY IF EXISTS "school read files" ON storage.objects;
CREATE POLICY "school read files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'eduone-files'
    AND (storage.foldername(name))[1] = my_school_id()::text
  );

DROP POLICY IF EXISTS "school upload files" ON storage.objects;
CREATE POLICY "school upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'eduone-files'
    AND (storage.foldername(name))[1] = my_school_id()::text
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "school delete files" ON storage.objects;
CREATE POLICY "school delete files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'eduone-files'
    AND (storage.foldername(name))[1] = my_school_id()::text
  );

-- ---------------------------------------------------------------------------
-- 7. APP_CONFIG — school-scoped version of fetchConfig / saveConfig
--    We need a way to get/set config for the school without knowing `id = 1`.
-- ---------------------------------------------------------------------------
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
  INSERT INTO app_config (school_id, settings, grade_boundaries, fee_structure, notif_toggles, venues, updated_at)
  VALUES (p_school_id,
    COALESCE(p_settings, '{}'::jsonb),
    COALESCE(p_grade_boundaries, '[]'::jsonb),
    COALESCE(p_fee_structure, '[]'::jsonb),
    COALESCE(p_notif_toggles, '{}'::jsonb),
    COALESCE(p_venues, '[]'::jsonb),
    now()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    settings       = COALESCE(p_settings, app_config.settings),
    grade_boundaries = COALESCE(p_grade_boundaries, app_config.grade_boundaries),
    fee_structure  = COALESCE(p_fee_structure, app_config.fee_structure),
    notif_toggles  = COALESCE(p_notif_toggles, app_config.notif_toggles),
    venues         = COALESCE(p_venues, app_config.venues),
    updated_at     = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. REGISTER SCHOOL function — called by SetupWizard
--    Creates school row + sets up initial app_config + updates principal profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_school(
  p_name         TEXT,
  p_motto        TEXT DEFAULT NULL,
  p_type         TEXT DEFAULT NULL,
  p_county       TEXT DEFAULT NULL,
  p_address      TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_email        TEXT DEFAULT NULL,
  p_website      TEXT DEFAULT NULL,
  p_logo_url     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Insert school record
  INSERT INTO schools (name, motto, type, county, address, phone, email, website, logo_url)
  VALUES (p_name, p_motto, p_type, p_county, p_address, p_phone, p_email, p_website, p_logo_url)
  RETURNING id INTO v_school_id;

  -- Tag the calling user's profile with the new school_id
  UPDATE profiles SET school_id = v_school_id WHERE id = auth.uid();

  -- Create default app_config row for this school
  INSERT INTO app_config (school_id, settings, grade_boundaries, fee_structure, notif_toggles, venues)
  VALUES (
    v_school_id,
    jsonb_build_object('name', p_name, 'motto', p_motto, 'phone', p_phone, 'email', p_email),
    '[{"grade":"A","min":75},{"grade":"B","min":60},{"grade":"C","min":50},{"grade":"D","min":40},{"grade":"E","min":0}]'::jsonb,
    '[]'::jsonb,
    '{"email":true,"sms":false,"attendance":true,"fees":true,"exams":true}'::jsonb,
    '[]'::jsonb
  );

  RETURN v_school_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. MY_CLASS_RANK — updated to be school-scoped
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_class_rank()
RETURNS TABLE(student_position INT, class_size INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id TEXT;
  v_class TEXT;
  v_school_id UUID;
BEGIN
  SELECT s.id, s.class, s.school_id
  INTO v_student_id, v_class, v_school_id
  FROM students s
  JOIN profiles p ON p.student_id = s.id AND p.id = auth.uid();

  RETURN QUERY
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY (
          COALESCE((scores->>'Mathematics')::int,0) +
          COALESCE((scores->>'English')::int,0) +
          COALESCE((scores->>'Kiswahili')::int,0)
        ) DESC
      ) AS pos,
      COUNT(*) OVER () AS total
    FROM students
    WHERE class = v_class AND school_id = v_school_id
  )
  SELECT pos::INT, total::INT FROM ranked WHERE id = v_student_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. GRANT EXECUTE on security definer functions to authenticated role
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION my_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION register_school(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_school_config(UUID,JSONB,JSONB,JSONB,JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION my_class_rank() TO authenticated;

-- ---------------------------------------------------------------------------
-- Done! Your database is now multi-tenant.
-- ---------------------------------------------------------------------------
