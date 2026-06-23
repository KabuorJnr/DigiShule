-- =====================================================================================
-- FULL DATA WIPE SCRIPT
-- =====================================================================================
-- WARNING: This will delete ALL data in the following tables across ALL schools.
-- Use ONLY if you want to start the database completely fresh.

TRUNCATE TABLE 
  expenses,
  finance_payments,
  invoices,
  school_events,
  notifications,
  timetables,
  exam_sessions,
  exam_schedules,
  teachers,
  students,
  staff
RESTART IDENTITY CASCADE;

-- If you also want to wipe the schools themselves (and app configs) uncomment below:
-- TRUNCATE TABLE schools RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE profiles RESTART IDENTITY CASCADE;
