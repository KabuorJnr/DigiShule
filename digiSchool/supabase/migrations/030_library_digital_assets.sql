-- Add columns for digital assets in the library
ALTER TABLE IF EXISTS public.library_books 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE;

-- Update RLS to ensure anyone in the school can read the digital library assets
-- Actually, the existing `school isolation` policy on library_books already allows 
-- authenticated users within the same school to select from library_books.
-- Therefore, students can already read the rows. No new policy is required for SELECT.
