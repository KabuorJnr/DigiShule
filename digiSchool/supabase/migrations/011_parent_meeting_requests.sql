-- ==============================================================================
-- Migration 011: Parent Meeting Requests
-- ==============================================================================

CREATE TABLE IF NOT EXISTS parent_meeting_requests (
  id TEXT PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  parent_name TEXT,
  student_id TEXT NOT NULL,
  student_name TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending', -- 'Pending', 'Scheduled', 'Rejected', 'Completed'
  scheduled_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE parent_meeting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school isolation" ON parent_meeting_requests;

CREATE POLICY "school isolation" ON parent_meeting_requests
FOR ALL USING (school_id = ANY(my_school_ids()))
WITH CHECK (school_id = ANY(my_school_ids()));
