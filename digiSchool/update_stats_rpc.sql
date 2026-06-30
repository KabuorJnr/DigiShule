-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_student_stats;

CREATE OR REPLACE FUNCTION get_student_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_active', COUNT(*) FILTER (WHERE status != 'Inactive' AND status != 'Graduated'),
    'male', COUNT(*) FILTER (WHERE gender = 'Male' AND status != 'Inactive' AND status != 'Graduated'),
    'female', COUNT(*) FILTER (WHERE gender = 'Female' AND status != 'Inactive' AND status != 'Graduated'),
    'flagged', COUNT(*) FILTER (WHERE flagged = true AND status != 'Inactive' AND status != 'Graduated')
  ) INTO result
  FROM students
  WHERE school_id = my_school_id();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
