-- Staff daily attendance register.
--
-- staff_attendance_logs stores device clock-ins keyed by an auth-user UUID.
-- Admin/roster marking works off the staff-table id (TEXT) and needs to record
-- a status per staff per day for reference and historical tracking. Rather than
-- overload the UUID-keyed clock-in table, this dedicated register keeps the
-- marked attendance so it is never lost after a refresh.
CREATE TABLE IF NOT EXISTS staff_daily_attendance (
    id TEXT PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    staff_name TEXT,
    role TEXT,
    dept TEXT,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Present',
    source TEXT DEFAULT 'manual',
    marked_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(school_id, staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_daily_attendance_date
    ON staff_daily_attendance (school_id, date);

ALTER TABLE staff_daily_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school isolation" ON staff_daily_attendance
    FOR ALL USING (school_id = ANY(my_school_ids()))
    WITH CHECK (school_id = ANY(my_school_ids()));
