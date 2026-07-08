-- 027_parent_signup_rpc.sql
-- Provides a secure way for unauthenticated parents to verify a student's admission number
-- at a specific school without exposing the entire students table.

CREATE OR REPLACE FUNCTION public.lookup_student_for_signup(p_school_id UUID, p_adm TEXT)
RETURNS TABLE (id TEXT, name TEXT, admission_number TEXT, school_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id, 
    s.name, 
    s.admission_number, 
    s.school_id 
  FROM students s
  WHERE s.school_id = p_school_id 
    AND s.admission_number ILIKE p_adm
  LIMIT 1;
$$;

-- Provides a secure way to list schools for the public signup wizard
CREATE OR REPLACE FUNCTION public.get_public_schools()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name FROM schools ORDER BY name;
$$;
