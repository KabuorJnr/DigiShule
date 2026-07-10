-- =============================================================================
-- Migration: 053_sync_teaching_staff.sql
-- Description: Syncs existing deputies and principals from the staff table 
--              into the teachers table so they can be assigned to teach.
-- =============================================================================

INSERT INTO public.teachers (id, name, role, emp_id, status, school_id)
SELECT id, name, role, id as emp_id, status, school_id
FROM public.staff
WHERE role IN ('deputy_admin', 'deputy_academic', 'principal')
ON CONFLICT (id) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
