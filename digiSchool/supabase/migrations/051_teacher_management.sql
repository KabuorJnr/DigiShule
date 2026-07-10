-- 051_teacher_management.sql
-- Teacher Management & Subject Assignment module
-- Creates departments, subjects, teacher qualifications, and subject assignments tables

-- ═══════════════════════════════════════════════════════════
-- 1. DEPARTMENTS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.departments;
CREATE POLICY "school isolation" ON public.departments
  USING (school_id = ANY(public.my_school_ids()))
  WITH CHECK (school_id = ANY(public.my_school_ids()));

-- Seed standard departments
-- (These will be inserted per-school when the admin first opens teacher management)

-- ═══════════════════════════════════════════════════════════
-- 2. SUBJECTS (catalog)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT TRUE,
  periods_per_week INT NOT NULL DEFAULT 5,
  department TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.subjects;
CREATE POLICY "school isolation" ON public.subjects
  USING (school_id = ANY(public.my_school_ids()))
  WITH CHECK (school_id = ANY(public.my_school_ids()));

-- ═══════════════════════════════════════════════════════════
-- 3. TEACHER SUBJECT QUALIFICATIONS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.teacher_subject_qualifications (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  qualification_level TEXT NOT NULL DEFAULT 'qualified'
    CHECK (qualification_level IN ('qualified', 'primary')),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, subject_id, school_id)
);

ALTER TABLE public.teacher_subject_qualifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.teacher_subject_qualifications;
CREATE POLICY "school isolation" ON public.teacher_subject_qualifications
  USING (school_id = ANY(public.my_school_ids()))
  WITH CHECK (school_id = ANY(public.my_school_ids()));

-- ═══════════════════════════════════════════════════════════
-- 4. SUBJECT ASSIGNMENTS (class-stream-subject → teacher)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subject_assignments (
  id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL,
  stream_name TEXT,
  subject_id TEXT NOT NULL,
  teacher_id TEXT,
  term TEXT NOT NULL,
  year INT NOT NULL,
  periods_per_week INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned', 'assigned')),
  assigned_at TIMESTAMPTZ,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_name, stream_name, subject_id, term, year, school_id)
);

ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "school isolation" ON public.subject_assignments;
CREATE POLICY "school isolation" ON public.subject_assignments
  AS PERMISSIVE FOR ALL
  USING (school_id = ANY(public.my_school_ids()))
  WITH CHECK (school_id = ANY(public.my_school_ids()));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
