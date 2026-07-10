-- 056_messages_replied_at.sql
-- Add replied_at to messages if missing

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
