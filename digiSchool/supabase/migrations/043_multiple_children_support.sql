-- ==============================================================================
-- Migration 043: Multiple Children Support for Parents
-- ==============================================================================

-- Add linked_students JSONB array to profiles to support parents having multiple children
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS linked_students JSONB DEFAULT '[]'::jsonb;

-- Populate existing linked_students with the primary student_id if it exists
UPDATE public.profiles
SET linked_students = jsonb_build_array(
  jsonb_build_object('id', student_id)
)
WHERE student_id IS NOT NULL 
  AND role = 'parent'
  AND (linked_students IS NULL OR jsonb_array_length(linked_students) = 0);
