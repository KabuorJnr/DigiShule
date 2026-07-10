-- 054_sync_multi_role_teachers.sql
-- Ensures any staff member who has a 'teacher' profile is present in the teachers table
-- even if their primary role in the staff table is something else (like 'librarian')

INSERT INTO public.teachers (id, name, role, emp_id, status, school_id)
SELECT DISTINCT s.id, s.name, 'teacher', s.id as emp_id, s.status, s.school_id
FROM public.staff s
JOIN public.profiles p ON s.id = p.id
WHERE p.role IN ('teacher', 'deputy_admin', 'deputy_academic', 'principal')
ON CONFLICT (id) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
