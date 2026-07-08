-- Fix notifications table columns
ALTER TABLE public.notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS audience TEXT[];
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- Ensure RLS is enabled and the policy is correct
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school isolation" ON public.notifications;
CREATE POLICY "school isolation" ON public.notifications
    FOR ALL USING (school_id = my_school_id())
    WITH CHECK (school_id = my_school_id());

-- Grant access to authenticated users
GRANT ALL ON TABLE public.notifications TO authenticated;
