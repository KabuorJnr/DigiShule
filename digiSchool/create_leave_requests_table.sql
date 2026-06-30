-- Create the leave_requests table for teacher leave applications
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id TEXT PRIMARY KEY,
  staff_name TEXT NOT NULL,
  staff_id TEXT,
  dept TEXT,
  type TEXT NOT NULL DEFAULT 'Annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
