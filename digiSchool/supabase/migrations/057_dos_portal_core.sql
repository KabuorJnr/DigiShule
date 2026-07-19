-- 057_dos_portal_core.sql

-- 1. Add 'dos' to app_role ENUM if it doesn't exist.
-- To do this safely in Postgres:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'dos') THEN
    ALTER TYPE app_role ADD VALUE 'dos';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create dos_users view over profiles to easily reference DoS users.
CREATE OR REPLACE VIEW dos_users AS
SELECT id, school_id, full_name, role, created_at
FROM profiles
WHERE role::text = 'dos' OR role::text = 'principal';

-- 3. Extend exam_schedules with Result Release gate columns.
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS results_approved boolean default false;
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS results_approved_by uuid;
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS results_approved_at timestamptz;

ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS released boolean default false;
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS released_by uuid;
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- 4. DoS-only tables (net new)

CREATE TABLE IF NOT EXISTS syllabus_coverage_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null,
  subject text not null,
  class text not null,
  term text not null,
  strands_total int not null,
  strands_covered int not null,
  as_of_date date not null default current_date,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS exam_papers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_id text not null references exam_schedules(id) on delete cascade,
  subject text not null,
  class text not null,
  set_by_teacher_id uuid,
  moderated_by uuid,
  moderation_status text default 'pending' check (moderation_status in ('pending','approved','revision_needed')),
  moderation_notes text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS lesson_observations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null,
  observed_by uuid not null,
  class text,
  subject text,
  observation_date date not null default current_date,
  checklist jsonb not null,
  strengths text,
  areas_to_improve text,
  follow_up_required boolean default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS approval_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  item_type text not null check (item_type in ('scheme_of_work','lesson_plan')),
  item_id uuid not null,
  teacher_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid,
  reviewer_notes text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);

-- 5. Enable RLS
ALTER TABLE syllabus_coverage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Note: 'dos' users and 'principal' can read/write within their school.
-- Teachers can only read/write their own stuff.

-- syllabus_coverage_snapshots
DROP POLICY IF EXISTS "school isolation" ON syllabus_coverage_snapshots;
CREATE POLICY "school isolation" ON syllabus_coverage_snapshots
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- exam_papers
DROP POLICY IF EXISTS "school isolation" ON exam_papers;
CREATE POLICY "school isolation" ON exam_papers
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- lesson_observations
DROP POLICY IF EXISTS "school isolation" ON lesson_observations;
CREATE POLICY "school isolation" ON lesson_observations
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- approval_queue
DROP POLICY IF EXISTS "school isolation" ON approval_queue;
CREATE POLICY "school isolation" ON approval_queue
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- 7. Fix `upsertRow` scoping issue for schemes_of_work and lesson_plans
-- Allow DoS to update status of schemes/lessons.
DROP POLICY IF EXISTS "update own schemes" ON schemes_of_work;
CREATE POLICY "update own schemes" ON schemes_of_work
    FOR UPDATE USING (school_id = my_school_id() AND (teacher_id = auth.uid() OR (SELECT role::text FROM profiles WHERE id = auth.uid()) IN ('dos'::text, 'principal'::text)))
    WITH CHECK (school_id = my_school_id() AND (teacher_id = auth.uid() OR (SELECT role::text FROM profiles WHERE id = auth.uid()) IN ('dos'::text, 'principal'::text)));

DROP POLICY IF EXISTS "update own lesson plans" ON lesson_plans;
CREATE POLICY "update own lesson plans" ON lesson_plans
    FOR UPDATE USING (school_id = my_school_id() AND (teacher_id = auth.uid() OR (SELECT role::text FROM profiles WHERE id = auth.uid()) IN ('dos'::text, 'principal'::text)))
    WITH CHECK (school_id = my_school_id() AND (teacher_id = auth.uid() OR (SELECT role::text FROM profiles WHERE id = auth.uid()) IN ('dos'::text, 'principal'::text)));

NOTIFY pgrst, 'reload schema';
