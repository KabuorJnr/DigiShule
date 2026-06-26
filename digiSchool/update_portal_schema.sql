-- 1. Create student_attendance table
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  student_id TEXT NOT NULL,
  adm TEXT NOT NULL,
  class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',
  remarks TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_attendance DISABLE ROW LEVEL SECURITY;

-- 2. Create assignment_submissions table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  adm TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted',
  grade TEXT,
  feedback TEXT,
  file_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assignment_submissions DISABLE ROW LEVEL SECURITY;
