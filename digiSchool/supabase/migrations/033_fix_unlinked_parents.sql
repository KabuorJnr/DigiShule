
-- Find all unlinked parents and link them to the most recently created student
DO $$$
DECLARE
  v_student_id UUID;
  v_school_id UUID;
BEGIN
  -- Get the most recently enrolled student
  SELECT id, school_id INTO v_student_id, v_school_id
  FROM public.students
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_student_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      student_id = v_student_id,
      school_id = COALESCE(school_id, v_school_id)
    WHERE role = 'parent' AND student_id IS NULL;
  END IF;
END $$$;

