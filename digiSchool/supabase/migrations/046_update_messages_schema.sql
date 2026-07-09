-- 046_update_messages_schema.sql
-- Add missing columns to messages table for clinic notifications

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS sender_role TEXT,
ADD COLUMN IF NOT EXISTS student_id TEXT;

-- Trigger a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
