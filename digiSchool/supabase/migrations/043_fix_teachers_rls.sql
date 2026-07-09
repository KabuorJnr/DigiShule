-- 043_fix_teachers_rls.sql
-- Force the teachers table to use the robust array-based my_school_ids() function
-- to prevent any subquery crashes during fetch operations.

ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

DROP POLICY IF EXISTS "school isolation" ON public.teachers;
CREATE POLICY "school isolation" ON public.teachers
  FOR ALL USING (school_id = ANY(public.my_school_ids()))
  WITH CHECK (school_id = ANY(public.my_school_ids()));

NOTIFY pgrst, 'reload schema';
