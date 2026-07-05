-- 021_fix_profiles_select_policy.sql
-- 1. Ensure users can ALWAYS read their own profile regardless of school_id constraints
CREATE POLICY "Users can always read their own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- 2. Backfill any recent profiles (like students) that were created with a NULL school_id
UPDATE public.profiles
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;
