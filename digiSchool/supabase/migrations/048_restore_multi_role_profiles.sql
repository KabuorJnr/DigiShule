-- 048_restore_multi_role_profiles.sql
-- Emergency fix: Restore profiles for staff members who lost a profile row
-- due to the incorrect deduplication in migration 047.
--
-- The system supports users with multiple roles (e.g. Nurse AND Librarian).
-- Each role is stored as a separate profile row with the same auth.uid().
-- Migration 047 incorrectly deleted "duplicate" profiles, breaking multi-role logins.
--
-- This migration re-creates missing profile rows by joining auth.users on email.
-- (staff.id stores the staff member's email address)

INSERT INTO public.profiles (id, username, full_name, role, school_id, created_at)
SELECT 
  u.id,  -- The real auth user UUID
  LOWER(REPLACE(s.name, ' ', '.')) || '_' || SUBSTR(u.id::text, 1, 6) AS username,
  s.name AS full_name,
  LOWER(s.role)::app_role,
  s.school_id,
  now()
FROM auth.users u
JOIN public.staff s ON LOWER(u.email) = LOWER(s.id)
WHERE 
  -- Only process staff with roles that are valid app_role enum values
  LOWER(s.role) IN (
    'principal', 'admin', 'school_admin', 'teacher', 'student', 'parent',
    'deputy_academics', 'deputy_admin', 'bursar', 'registrar', 'librarian',
    'clinic', 'nurse', 'finance', 'staff'
  )
  -- Only re-insert where there is NO matching profile for this auth user + role
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = u.id
    AND p.role::text = LOWER(s.role)
  )
  AND s.school_id IS NOT NULL
  AND s.status != 'Inactive';

NOTIFY pgrst, 'reload schema';

-- Note for admin: If a specific staff member still can't log in, please use 
-- the Admin Portal > Staff > Commission/Re-activate to re-create their credentials.

NOTIFY pgrst, 'reload schema';

