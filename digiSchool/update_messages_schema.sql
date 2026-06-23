-- Run this in your Supabase SQL Editor to create the missing messages table

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  recipient_role TEXT,
  student_name TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'Unread',
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
