-- 017_admin_insert_profiles.sql
-- Fix Row-Level Security so Administrators can create profiles for new staff and parents

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND LOWER(p.role::text) IN ('principal', 'admin', 'registrar', 'superadmin', 'bursar', 'finance')
  )
);
