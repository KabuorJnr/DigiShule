-- Supabase Full Database Schema for EduOne
-- Run this entire script in the Supabase SQL Editor

-- 1. Schools Table (Multi-tenancy support)
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

-- 2. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  dept TEXT,
  teacher_id TEXT,
  student_id TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adm TEXT UNIQUE NOT NULL,
  class TEXT NOT NULL,
  gender TEXT,
  birth_cert_no TEXT,
  scores JSONB DEFAULT '{}'::jsonb,
  flagged BOOLEAN DEFAULT false,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  parent_address TEXT,
  admission_letter_url TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  role TEXT,
  emp_id TEXT UNIQUE,
  phone TEXT,
  status TEXT DEFAULT 'Active',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Exam Schedules Table
CREATE TABLE IF NOT EXISTS exam_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sessions JSONB DEFAULT '[]'::jsonb,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Exam Sessions Table (Optional detail table, can be managed inside the JSONB above)
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

-- 7. Timetables Table
CREATE TABLE IF NOT EXISTS timetables (
  id TEXT PRIMARY KEY,
  class TEXT NOT NULL,
  term TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class, term, school_id)
);

-- 8. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'all',
  date TEXT NOT NULL,
  posted_by TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Events Table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "desc" TEXT,
  date TEXT NOT NULL,
  date_end TEXT,
  type TEXT,
  audience TEXT[],
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. RPC for Authentication Login Fallback
CREATE OR REPLACE FUNCTION email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

-- 11. RPC for Registering a School
CREATE OR REPLACE FUNCTION register_school(
  p_name TEXT, p_motto TEXT, p_type TEXT, p_county TEXT, 
  p_address TEXT, p_phone TEXT, p_email TEXT, p_website TEXT, p_logo_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  INSERT INTO schools (name, motto, type, county, address, phone, email, website, logo_url)
  VALUES (p_name, p_motto, p_type, p_county, p_address, p_phone, p_email, p_website, p_logo_url)
  RETURNING id INTO v_school_id;
  
  RETURN v_school_id;
END;
$$;

-- 12. RPC for Class Rank
CREATE OR REPLACE FUNCTION my_class_rank()
RETURNS TABLE(student_position INT, class_size INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT 1, 40;
END;
$$;

-- 13. Finance Tables
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

-- 13. Disable RLS across the board temporarily
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetables DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- 14. Settings RPC
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

-- 14. School Events
CREATE TABLE IF NOT EXISTS school_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "desc" TEXT,
  date TEXT NOT NULL,
  type TEXT DEFAULT 'academic',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. RPC for RLS
CREATE OR REPLACE FUNCTION my_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id
  FROM profiles
  WHERE id = auth.uid();
  RETURN v_school_id;
END;
$$;

ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their school's events"
ON school_events FOR SELECT USING (school_id = my_school_id());

CREATE POLICY "Users can insert their school's events"
ON school_events FOR INSERT WITH CHECK (school_id = my_school_id());

CREATE POLICY "Users can update their school's events"
ON school_events FOR UPDATE USING (school_id = my_school_id());

CREATE POLICY "Users can delete their school's events"
ON school_events FOR DELETE USING (school_id = my_school_id());

-- 15. Job Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  email TEXT,
  experience_years INT,
  applied_date DATE NOT NULL,
  status TEXT DEFAULT 'New',
  interview_date DATE,
  interview_time TIME,
  interview_type TEXT,
  notes TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;

-- 16. Library Books
CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  category TEXT,
  copies INT DEFAULT 1,
  available INT DEFAULT 1,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE library_books DISABLE ROW LEVEL SECURITY;

-- 17. Library Loans
CREATE TABLE IF NOT EXISTS library_loans (
  id TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  student TEXT NOT NULL,
  adm TEXT,
  student_id TEXT,
  borrowed TEXT,
  due TEXT,
  status TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE library_loans DISABLE ROW LEVEL SECURITY;

-- 18. Clinic Visits
CREATE TABLE IF NOT EXISTS clinic_visits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  student TEXT NOT NULL,
  adm TEXT,
  complaint TEXT,
  treatment TEXT,
  outcome TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clinic_visits DISABLE ROW LEVEL SECURITY;

-- 19. Admissions
CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kcpe INT,
  gender TEXT,
  "Grade" TEXT,
  date TEXT,
  status TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admissions DISABLE ROW LEVEL SECURITY;

-- 20. Disciplinary Records
CREATE TABLE IF NOT EXISTS disciplinary_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  student TEXT NOT NULL,
  adm TEXT,
  class TEXT,
  category TEXT,
  description TEXT,
  action TEXT,
  severity TEXT,
  status TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE disciplinary_records DISABLE ROW LEVEL SECURITY;

-- 21. Staff
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

-- 22. Facilities
CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  capacity INT,
  status TEXT,
  note TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE facilities DISABLE ROW LEVEL SECURITY;

-- 23. Messages
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
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
