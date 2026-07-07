-- =============================================================================
-- CBC Schemes of Work and Lesson Plans
-- =============================================================================

-- schemes_of_work: one row per (teacher, class, subject, term, week)
CREATE TABLE IF NOT EXISTS schemes_of_work (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null,
  teacher_name text,
  class text not null,
  subject text not null,
  term text not null,
  week_number int not null,
  strand text,
  sub_strand text,
  specific_learning_outcomes text,
  key_inquiry_questions text,
  learning_resources text,
  assessment_method text,
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- lesson_plans: one row per lesson, linked back to its scheme week where possible
CREATE TABLE IF NOT EXISTS lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null,
  teacher_name text,
  scheme_of_work_id uuid references schemes_of_work(id) on delete set null,
  class text not null,
  subject text not null,
  term text not null,
  date date not null,
  time_slot text,
  strand text,
  sub_strand text,
  specific_learning_outcomes text,
  key_inquiry_questions text,
  learning_resources text,
  core_competencies text[],
  values_developed text[],
  pcis text,
  intro_activities text,
  development_step1 text,
  development_step2 text,
  development_step3 text,
  extended_activities text,
  conclusion text,
  reflection text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE schemes_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- Policies mirroring 001_multi_tenant.sql exactly
DROP POLICY IF EXISTS "school isolation" ON schemes_of_work;
CREATE POLICY "school isolation" ON schemes_of_work
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "school isolation" ON lesson_plans;
CREATE POLICY "school isolation" ON lesson_plans
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS schemes_of_work_school_id_idx ON schemes_of_work(school_id);
CREATE INDEX IF NOT EXISTS lesson_plans_school_id_idx ON lesson_plans(school_id);
CREATE INDEX IF NOT EXISTS lesson_plans_scheme_id_idx ON lesson_plans(scheme_of_work_id);
