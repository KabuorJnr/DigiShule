-- 041_fix_lookup_student_rpc.sql

-- Drop the previous version that required p_school_id and had a strict signature
DROP FUNCTION IF EXISTS public.lookup_student_for_signup(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.lookup_student_for_signup(TEXT, TEXT, UUID);

-- Recreate with p_school_id as optional (DEFAULT NULL) 
-- PostgREST will map JSON keys to these arguments regardless of order,
-- and will allow omitting p_school_id.
CREATE OR REPLACE FUNCTION public.lookup_student_for_signup(
    p_adm TEXT, 
    p_parent_pin TEXT, 
    p_school_id UUID DEFAULT NULL
)
RETURNS TABLE (id TEXT, name TEXT, adm TEXT, school_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id, 
    s.name, 
    s.adm, 
    s.school_id 
  FROM students s
  WHERE (p_school_id IS NULL OR s.school_id = p_school_id)
    AND s.adm ILIKE p_adm
    AND s.parent_pin = p_parent_pin
  LIMIT 1;
$$;

-- Force Supabase PostgREST API to reload its schema cache
NOTIFY pgrst, 'reload schema';
