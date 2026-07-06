-- 025_link_parent_to_student.sql
-- Forcefully links any unlinked parent accounts to the specified student (adm/002)

DO $$
DECLARE
  v_student_id UUID;
  v_school_id UUID;
BEGIN
  -- 1. Find the student by admission number
  SELECT id, school_id INTO v_student_id, v_school_id
  FROM students
  WHERE admission_number ILIKE 'adm/002'
  LIMIT 1;

  IF v_student_id IS NOT NULL THEN
    -- 2. Update parent profiles that have no student linked
    UPDATE profiles
    SET 
      student_id = v_student_id,
      school_id = v_school_id
    WHERE role = 'parent' AND student_id IS NULL;
  END IF;
END $$;
