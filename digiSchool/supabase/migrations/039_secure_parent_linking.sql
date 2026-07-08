-- 039_secure_parent_linking.sql

-- 1. Add parent_pin to students if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='parent_pin') THEN
    ALTER TABLE public.students ADD COLUMN parent_pin TEXT;
  END IF;
END $$;

-- 2. Retroactively generate random 6-digit PINs for all existing students where it is missing
UPDATE public.students 
SET parent_pin = LPAD(FLOOR(RANDOM() * 999999)::INT::TEXT, 6, '0')
WHERE parent_pin IS NULL;

-- 3. Ensure the RPC function requires the parent PIN
DROP FUNCTION IF EXISTS public.lookup_student_for_signup(UUID, TEXT);
DROP FUNCTION IF EXISTS public.lookup_student_for_signup(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.lookup_student_for_signup(p_school_id UUID, p_adm TEXT, p_parent_pin TEXT)
RETURNS TABLE (id TEXT, name TEXT, adm TEXT, school_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id, 
    s.name, 
    s.adm, 
    s.school_id 
  FROM students s
  WHERE s.school_id = p_school_id 
    AND s.adm ILIKE p_adm
    AND s.parent_pin = p_parent_pin
  LIMIT 1;
$$;

-- 4. Create a trigger function to auto-generate parent_pin on new student insert if missing
CREATE OR REPLACE FUNCTION public.set_default_parent_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_pin IS NULL THEN
    NEW.parent_pin := LPAD(FLOOR(RANDOM() * 999999)::INT::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to students table
DROP TRIGGER IF EXISTS trigger_set_parent_pin ON public.students;
CREATE TRIGGER trigger_set_parent_pin
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.set_default_parent_pin();
