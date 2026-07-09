-- 045_fix_admin_profile_updates.sql
-- Allow Admins to update user profiles (e.g. during staff commissioning)
-- and backfill any missing school_id in profiles from the staff table.

-- Add a policy for Admins to update profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  AND (school_id = ANY(public.my_school_ids()) OR school_id IS NULL)
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Backfill missing school_ids in profiles for staff who were commissioned
-- but their profile upsert failed due to the previous RLS restrictions.
UPDATE public.profiles p
SET school_id = s.school_id
FROM public.staff s
WHERE p.id::text = s.id AND p.school_id IS NULL;
