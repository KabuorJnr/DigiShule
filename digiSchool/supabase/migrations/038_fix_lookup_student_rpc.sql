-- 038_fix_lookup_student_rpc.sql

-- Drops the old function if it exists to avoid return type mismatch errors
DROP FUNCTION IF EXISTS public.lookup_student_for_signup(UUID, TEXT);

-- Creates the corrected function using 'admission_number' instead of 'adm'
CREATE OR REPLACE FUNCTION public.lookup_student_for_signup(p_school_id UUID, p_adm TEXT)
RETURNS TABLE (id TEXT, name TEXT, admission_number TEXT, school_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS \$\$
  SELECT 
    s.id, 
    s.name, 
    s.admission_number, 
    s.school_id 
  FROM students s
  WHERE s.school_id = p_school_id 
    AND s.admission_number ILIKE p_adm
  LIMIT 1;
\$\$;
