-- Migration: Fix Students RLS & Enable Real-Time
-- Description:
-- 1. Updates students RLS to use ANY(my_school_ids()) to prevent multi-role query failures.
-- 2. Adds students to the supabase_realtime publication to enable instant UI updates on grade entry.

-- 1. Update RLS Policy
DROP POLICY IF EXISTS "school isolation" ON public.students;
CREATE POLICY "school isolation" ON public.students
  FOR ALL USING (school_id = ANY(my_school_ids()))
  WITH CHECK (school_id = ANY(my_school_ids()));

-- 2. Enable Real-Time for students (and a few others just in case they were missed but are synced)
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
