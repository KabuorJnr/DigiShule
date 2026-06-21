-- Migration: 002_cbc_grading_migration.sql
-- Description: Wipes out legacy 8-4-4 percentage-based scores from the students table 
-- to prevent crashes when the new CBC 1-4 rubric logic parses the scores.
-- It also resets any custom school grade boundaries back to the new CBC defaults.

-- 1. Wipe old percentage scores from all students
UPDATE students 
SET scores = '{}'::jsonb
WHERE scores IS NOT NULL AND scores::text != '{}';

-- 2. Reset grade boundaries for all schools to the new CBC standard
UPDATE schools
SET grade_boundaries = '[
  {"min": 3.5, "grade": "EE"},
  {"min": 2.5, "grade": "ME"},
  {"min": 1.5, "grade": "AE"},
  {"min": 0, "grade": "BE"}
]'::jsonb;
