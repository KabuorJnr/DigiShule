-- 056_messages_replied_at.sql
-- Add reply, replied_at, and recipient_id columns to messages table

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply TEXT,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recipient_id TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
