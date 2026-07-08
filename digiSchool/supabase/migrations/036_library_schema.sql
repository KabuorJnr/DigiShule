
CREATE TABLE IF NOT EXISTS public.library_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  category TEXT,
  copies INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  is_digital BOOLEAN DEFAULT FALSE,
  file_url TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_loans (
  id TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  student TEXT NOT NULL,
  adm TEXT,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  borrowed DATE NOT NULL,
  due DATE NOT NULL,
  status TEXT DEFAULT 'Borrowed',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school isolation" ON public.library_books
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

CREATE POLICY "school isolation" ON public.library_loans
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));
