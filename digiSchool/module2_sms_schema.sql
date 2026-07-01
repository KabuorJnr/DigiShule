-- Run this in your Supabase SQL Editor to create the SMS Logs table.

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  sender_role TEXT,
  recipient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their school's SMS logs" 
  ON sms_logs FOR SELECT 
  USING (school_id = my_school_id());

CREATE POLICY "Users can insert SMS logs for their school" 
  ON sms_logs FOR INSERT 
  WITH CHECK (school_id = my_school_id());
