-- restore_school_classes.sql
-- This script restores the default classes setting for all schools 
-- where classes is currently NULL or an empty array.

UPDATE school_settings
SET classes = '[
  {"name": "Grade 7", "streams": "A, B"},
  {"name": "Grade 8", "streams": "A, B"},
  {"name": "Grade 9", "streams": "A, B"},
  {"name": "Grade 10", "streams": "A, B"},
  {"name": "Grade 11", "streams": "A, B"},
  {"name": "Grade 12", "streams": "A, B"}
]'::jsonb
WHERE classes IS NULL OR jsonb_array_length(classes) = 0;
