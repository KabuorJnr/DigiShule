-- 048_restore_multi_role_profiles.sql
-- Emergency fix: Restore profiles for staff members who lost a profile row
-- due to the incorrect deduplication in migration 047.
--
-- The system supports users with multiple roles (e.g. Nurse AND Librarian).
-- Each role is stored as a separate profile row with the same auth.uid().
-- Migration 047 incorrectly deleted "duplicate" profiles, breaking multi-role logins.
--
-- This migration re-creates any missing profile rows from the staff table.

INSERT INTO public.profiles (id, full_name, role, school_id, created_at)
SELECT 
  gen_random_uuid() AS id,
  s.name AS full_name,
  s.role,
  s.school_id,
  now()
FROM public.staff s
WHERE 
  -- Only re-insert where there is NO matching profile with the same name AND role
  NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE LOWER(COALESCE(p.full_name, '')) = LOWER(s.name) 
    AND p.role::text = s.role
    AND p.school_id = s.school_id
  )
  AND s.school_id IS NOT NULL
  AND s.status != 'Inactive';

-- Note for admin: If a specific staff member still can't log in, please use 
-- the Admin Portal > Staff > Commission/Re-activate to re-create their credentials.

NOTIFY pgrst, 'reload schema';

