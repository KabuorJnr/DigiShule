-- 070_fix_is_staff_multi_profile.sql
-- Fixes "more than one row returned by a subquery used as an expression"
-- for users with multiple profiles (e.g. DEN-NURSE/LIB holding both Clinic and Librarian roles).
--
-- Previously:
--   is_staff() used:
--     (select role not in ('student', 'parent') from public.profiles where id = auth.uid())
--   which returns 2+ rows for multi-role users, crashing RLS queries on students, profiles, etc.
--
-- Now:
--   Uses EXISTS() which safely checks if ANY of the user's profiles is a staff role.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::text NOT IN ('student', 'parent')
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_student_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT student_id FROM public.profiles 
  WHERE id = auth.uid() AND student_id IS NOT NULL 
  LIMIT 1;
$$;

-- Ensure my_school_id and my_school_ids are also multi-profile safe
CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT school_id FROM public.profiles 
  WHERE id = auth.uid() AND school_id IS NOT NULL 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(distinct school_id) filter (where school_id is not null), '{}') 
  FROM public.profiles 
  WHERE id = auth.uid();
$$;

NOTIFY pgrst, 'reload schema';
