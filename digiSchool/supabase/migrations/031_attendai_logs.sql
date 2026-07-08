CREATE TABLE IF NOT EXISTS staff_attendance_logs (
    id TEXT PRIMARY KEY,
    staff_id UUID NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    status TEXT DEFAULT 'Present',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(staff_id, date)
);

ALTER TABLE staff_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school isolation" ON staff_attendance_logs
    FOR ALL USING (school_id = ANY(my_school_ids()))
    WITH CHECK (school_id = ANY(my_school_ids()));
