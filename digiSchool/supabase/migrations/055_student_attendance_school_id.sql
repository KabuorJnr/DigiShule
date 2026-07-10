-- 055_student_attendance_school_id.sql
-- Add school_id to student_attendance if missing

ALTER TABLE public.student_attendance 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Update RLS policy to ensure school isolation
DROP POLICY IF EXISTS "school isolation" ON public.student_attendance;
CREATE POLICY "school isolation" ON public.student_attendance
  FOR ALL USING (school_id = ANY(my_school_ids()));
