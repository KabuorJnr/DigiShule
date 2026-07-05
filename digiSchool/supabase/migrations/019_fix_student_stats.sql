-- 019_fix_student_stats.sql
-- Fix get_student_stats to include students with a NULL status as 'Active'

CREATE OR REPLACE FUNCTION get_student_stats()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_active', COUNT(*) FILTER (WHERE COALESCE(status, 'Active') NOT IN ('Inactive', 'Graduated')),
    'male', COUNT(*) FILTER (WHERE gender = 'Male' AND COALESCE(status, 'Active') NOT IN ('Inactive', 'Graduated')),
    'female', COUNT(*) FILTER (WHERE gender = 'Female' AND COALESCE(status, 'Active') NOT IN ('Inactive', 'Graduated')),
    'flagged', COUNT(*) FILTER (WHERE flagged = true AND COALESCE(status, 'Active') NOT IN ('Inactive', 'Graduated'))
  ) INTO result
  FROM students
  WHERE school_id = my_school_id();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
