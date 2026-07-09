-- 047_fix_subquery_and_profiles_rls.sql
-- Fixes "more than one row returned by a subquery used as an expression"
-- This was caused by migration 045 which introduced a scalar subquery
-- (SELECT role FROM profiles WHERE id = auth.uid()) that fails when a user
-- has more than one profile row.
--
-- Fix 1: Restore the correct, safe "Admins can update profiles" policy using EXISTS()
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role::text IN ('principal', 'admin', 'school_admin', 'registrar', 'superadmin', 'bursar', 'finance', 'deputy_admin', 'deputy_academic')
    LIMIT 1
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role::text IN ('principal', 'admin', 'school_admin', 'registrar', 'superadmin', 'bursar', 'finance', 'deputy_admin', 'deputy_academic')
    LIMIT 1
  )
);

-- Fix 2: Backfill missing school_ids in profiles from the staff table
-- (redo the backfill from 045 since that migration may have aborted)
UPDATE public.profiles p
SET school_id = s.school_id
FROM public.staff s
WHERE p.id::text = s.id AND p.school_id IS NULL AND s.school_id IS NOT NULL;

-- Fix 3: Deduplicate profiles table if any user has more than one row
-- Keep the row with the most recent created_at
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC NULLS LAST) AS rn
    FROM public.profiles
  ) sub
  WHERE rn > 1
);

NOTIFY pgrst, 'reload schema';
