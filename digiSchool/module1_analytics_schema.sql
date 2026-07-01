-- Run this in your Supabase SQL Editor to install the Analytics Module aggregation functions.

-- 1. Function to get school-wide subject performance averages
DROP FUNCTION IF EXISTS get_academic_analytics;

CREATE OR REPLACE FUNCTION get_academic_analytics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  WITH subject_scores AS (
    -- Unpack the JSONB scores for every student in the school and average them by subject
    SELECT 
      key AS subject, 
      AVG(value::numeric) AS average_score
    FROM students, jsonb_each_text(scores)
    WHERE school_id = my_school_id()
    GROUP BY key
  ),
  formatted_scores AS (
    SELECT 
      subject as name, 
      ROUND(average_score, 1) as score 
    FROM subject_scores 
    ORDER BY average_score DESC
  )
  SELECT json_build_object(
    'top_subjects', COALESCE((SELECT json_agg(row_to_json(formatted_scores)) FROM formatted_scores), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
