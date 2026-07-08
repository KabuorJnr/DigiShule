
-- 034_admin_update_profiles.sql
-- Fix Row-Level Security so Administrators can update profiles (e.g. to link parent to student)

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND LOWER(p.role::text) IN ('principal', 'admin', 'registrar', 'superadmin', 'bursar', 'finance')
  )
);

