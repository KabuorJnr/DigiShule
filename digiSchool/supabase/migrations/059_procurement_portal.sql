-- 059_procurement_portal.sql
-- Enables public read access to published tenders for the public school landing page

-- Allow public to read published tenders
DROP POLICY IF EXISTS "Public can view published tenders" ON public.tenders;
CREATE POLICY "Public can view published tenders" ON public.tenders
  FOR SELECT USING (published = true);

-- Ensure public can read schools to resolve the landing page domain/id
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view schools" ON public.schools;
CREATE POLICY "Public can view schools" ON public.schools
  FOR SELECT USING (true);
