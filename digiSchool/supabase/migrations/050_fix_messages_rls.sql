-- 050_fix_messages_rls.sql
-- Allow clinic/nurse staff to INSERT messages to parents
-- and allow parents to SELECT messages addressed to them

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop old blanket policies
DROP POLICY IF EXISTS "school isolation" ON public.messages;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- School members can read messages in their school
CREATE POLICY "school members read messages"
ON public.messages FOR SELECT
USING (school_id = ANY(public.my_school_ids()));

-- Any authenticated school member can insert messages
CREATE POLICY "school members send messages"
ON public.messages FOR INSERT
WITH CHECK (school_id = ANY(public.my_school_ids()));

-- Allow update (mark as read)
CREATE POLICY "school members update messages"
ON public.messages FOR UPDATE
USING (school_id = ANY(public.my_school_ids()));

NOTIFY pgrst, 'reload schema';
