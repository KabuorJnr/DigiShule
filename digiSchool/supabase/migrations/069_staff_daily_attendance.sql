-- 069_staff_daily_attendance.sql
-- The admin-marked daily staff register (distinct from device clock-ins in
-- staff_attendance_logs). The app writes here from StaffAttendance's
-- "Save Register" / "Change Status" actions, but the table was never created,
-- so every save failed with PGRST205 ("Could not find the table
-- 'public.staff_daily_attendance' in the schema cache").

CREATE TABLE IF NOT EXISTS public.staff_daily_attendance (
  id          text PRIMARY KEY,
  staff_id    text,
  staff_name  text,
  role        text,
  dept        text,
  date        date,
  status      text,
  source      text,
  marked_by   text,
  school_id   uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_daily_attendance_school_date_idx
  ON public.staff_daily_attendance (school_id, date);

ALTER TABLE public.staff_daily_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school isolation" ON public.staff_daily_attendance;
CREATE POLICY "school isolation" ON public.staff_daily_attendance
  FOR ALL USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

GRANT ALL ON TABLE public.staff_daily_attendance TO authenticated;

NOTIFY pgrst, 'reload schema';
