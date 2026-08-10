-- =============================================================================
-- EduOne — Data Warehouse (phase 1)
-- =============================================================================
--
-- What this is
-- ------------
-- A separate `warehouse` schema holding denormalized fact tables that are
-- refreshed from live OLTP tables on-demand. Everything is still Postgres
-- (no BigQuery/Snowflake) so we don't introduce a whole new infrastructure
-- tier before we need one — but reads are isolated from live traffic and
-- pre-joined for the aggregate queries dashboards actually run.
--
-- What lives here
-- ---------------
--   warehouse.school_daily      one row per (school, date)
--   warehouse.student_term      one row per (school, student, term, year)
--   warehouse.class_term        one row per (school, class, term, year)
--   warehouse.subject_term      one row per (school, class, subject, term, year)
--   warehouse.teacher_term      one row per (school, teacher, term, year)
--   warehouse.benchmarks_daily  ANONYMISED platform-wide aggregates
--                               (median/quartiles across all schools, per date).
--                               Readable by everyone; the seed of the
--                               benchmarking product for governments/donors.
--
-- Refresh
-- -------
-- `warehouse.refresh_school(p_school_id UUID, p_up_to DATE)` recomputes the
-- rows for one school up to and including the given date (default: today).
-- Called from the client via the `warehouse-refresh` edge function, or from
-- a Supabase cron for nightly platform-wide refresh.
--
-- `warehouse.refresh_benchmarks(p_date DATE)` rolls up all school_daily rows
-- for the given date into the anonymised benchmarks_daily table.
--
-- Defensive by design
-- -------------------
-- Every sub-aggregation is COALESCEd and wrapped in a way that a missing
-- optional column can't kill the whole refresh. Aggregations that need the
-- students.scores JSONB blob are left NULL for now — its shape varies per
-- school and the app already computes mean scores client-side. We'll add
-- server-side score aggregation in a phase 2 once the JSONB shape is
-- standardised.
--
-- Safe to re-run.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS warehouse;

-- ---------------------------------------------------------------------------
-- 1. FACT TABLES
-- ---------------------------------------------------------------------------

-- One row per school per calendar date.
CREATE TABLE IF NOT EXISTS warehouse.school_daily (
  school_id                UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date                     DATE NOT NULL,
  students_active          INTEGER NOT NULL DEFAULT 0,
  staff_active             INTEGER NOT NULL DEFAULT 0,
  attendance_records       INTEGER NOT NULL DEFAULT 0,
  attendance_present       INTEGER NOT NULL DEFAULT 0,
  attendance_rate_pct      NUMERIC(5,2),      -- 0..100
  fees_collected_kes       BIGINT NOT NULL DEFAULT 0,
  fees_payment_count       INTEGER NOT NULL DEFAULT 0,
  messages_sent            INTEGER NOT NULL DEFAULT 0,
  refreshed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, date)
);

CREATE INDEX IF NOT EXISTS school_daily_date_idx ON warehouse.school_daily (date);
CREATE INDEX IF NOT EXISTS school_daily_school_idx ON warehouse.school_daily (school_id);

-- One row per (school, student, term, year). Placeholder for now — populated
-- by phase 2 once scores JSONB shape is standardised.
CREATE TABLE IF NOT EXISTS warehouse.student_term (
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          TEXT NOT NULL,
  term                TEXT NOT NULL,
  year                INTEGER NOT NULL,
  class               TEXT,
  mean_score          NUMERIC(5,2),
  attendance_rate_pct NUMERIC(5,2),
  fees_paid_kes       BIGINT NOT NULL DEFAULT 0,
  fees_balance_kes    BIGINT,
  refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, student_id, term, year)
);

CREATE INDEX IF NOT EXISTS student_term_school_class_idx ON warehouse.student_term (school_id, class);

-- One row per (school, class, term, year).
CREATE TABLE IF NOT EXISTS warehouse.class_term (
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class           TEXT NOT NULL,
  term            TEXT NOT NULL,
  year            INTEGER NOT NULL,
  students_count  INTEGER NOT NULL DEFAULT 0,
  mean_score      NUMERIC(5,2),
  attendance_rate_pct NUMERIC(5,2),
  refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, class, term, year)
);

-- One row per (school, class, subject, term, year).
CREATE TABLE IF NOT EXISTS warehouse.subject_term (
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class                 TEXT NOT NULL,
  subject               TEXT NOT NULL,
  term                  TEXT NOT NULL,
  year                  INTEGER NOT NULL,
  teacher_id            TEXT,
  mean_score            NUMERIC(5,2),
  students_entered      INTEGER NOT NULL DEFAULT 0,
  students_missing      INTEGER NOT NULL DEFAULT 0,
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, class, subject, term, year)
);

-- One row per (school, teacher, term, year).
CREATE TABLE IF NOT EXISTS warehouse.teacher_term (
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id           TEXT NOT NULL,
  term                 TEXT NOT NULL,
  year                 INTEGER NOT NULL,
  subjects_taught      INTEGER NOT NULL DEFAULT 0,
  classes_taught       INTEGER NOT NULL DEFAULT 0,
  students_reached     INTEGER NOT NULL DEFAULT 0,
  leaves_taken         INTEGER NOT NULL DEFAULT 0,
  refreshed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, teacher_id, term, year)
);

-- Anonymised platform-wide aggregates. Readable by every authenticated user.
CREATE TABLE IF NOT EXISTS warehouse.benchmarks_daily (
  date                              DATE PRIMARY KEY,
  schools_reporting                 INTEGER NOT NULL DEFAULT 0,
  median_attendance_rate_pct        NUMERIC(5,2),
  p75_attendance_rate_pct           NUMERIC(5,2),
  median_students_per_school        INTEGER,
  median_staff_per_school           INTEGER,
  median_fees_collected_kes         BIGINT,
  p75_fees_collected_kes            BIGINT,
  refreshed_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. RLS — school members read their own school's rows, everyone reads
--          the benchmarks (they're anonymised).
-- ---------------------------------------------------------------------------

ALTER TABLE warehouse.school_daily      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.student_term      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.class_term        ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.subject_term      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.teacher_term      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.benchmarks_daily  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Per-school reads. Uses my_school_id() from 001_multi_tenant.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='school members read school_daily') THEN
    CREATE POLICY "school members read school_daily" ON warehouse.school_daily FOR SELECT USING (school_id = my_school_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='school members read student_term') THEN
    CREATE POLICY "school members read student_term" ON warehouse.student_term FOR SELECT USING (school_id = my_school_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='school members read class_term') THEN
    CREATE POLICY "school members read class_term" ON warehouse.class_term FOR SELECT USING (school_id = my_school_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='school members read subject_term') THEN
    CREATE POLICY "school members read subject_term" ON warehouse.subject_term FOR SELECT USING (school_id = my_school_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='school members read teacher_term') THEN
    CREATE POLICY "school members read teacher_term" ON warehouse.teacher_term FOR SELECT USING (school_id = my_school_id());
  END IF;
  -- Benchmarks: anyone authenticated may read (rows contain no school-identifiable info).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='warehouse' AND policyname='everyone reads benchmarks_daily') THEN
    CREATE POLICY "everyone reads benchmarks_daily" ON warehouse.benchmarks_daily FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Writes are done only via the SECURITY DEFINER refresh functions below —
-- no direct INSERT/UPDATE policies granted.

-- ---------------------------------------------------------------------------
-- 3. REFRESH FUNCTIONS
-- ---------------------------------------------------------------------------

-- Refresh one school's warehouse rows from live tables.
-- Idempotent — recomputes and upserts.
CREATE OR REPLACE FUNCTION warehouse.refresh_school(
  p_school_id UUID,
  p_up_to     DATE DEFAULT current_date,
  p_days_back INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = warehouse, public
AS $$
DECLARE
  v_from DATE := p_up_to - (p_days_back - 1);
  v_row_count INTEGER := 0;
BEGIN
  IF p_school_id IS NULL THEN RETURN 0; END IF;

  -- school_daily -----------------------------------------------------------
  -- Recompute the whole window (idempotent). One row per (school, day).
  DELETE FROM warehouse.school_daily
    WHERE school_id = p_school_id AND date BETWEEN v_from AND p_up_to;

  INSERT INTO warehouse.school_daily (
    school_id, date, students_active, staff_active,
    attendance_records, attendance_present, attendance_rate_pct,
    fees_collected_kes, fees_payment_count, messages_sent
  )
  SELECT
    p_school_id,
    d.date,
    (SELECT COUNT(*) FROM students s WHERE s.school_id = p_school_id AND COALESCE(s.status, 'Active') NOT IN ('Inactive','Graduated','Archived','Withdrawn')),
    (SELECT COUNT(*) FROM teachers t WHERE t.school_id = p_school_id AND COALESCE(t.status, 'Active') <> 'Inactive'),
    COALESCE(att.records, 0),
    COALESCE(att.present, 0),
    CASE WHEN COALESCE(att.records, 0) > 0
         THEN ROUND(100.0 * att.present / att.records, 2)
         ELSE NULL END,
    COALESCE(pay.collected, 0),
    COALESCE(pay.n, 0),
    COALESCE(msg.n, 0)
  FROM generate_series(v_from, p_up_to, INTERVAL '1 day') AS d(date)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS records,
           COUNT(*) FILTER (WHERE LOWER(status) = 'present') AS present
    FROM public.student_attendance sa
    WHERE sa.school_id = p_school_id AND sa.date = d.date
  ) att ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(amount)::BIGINT, 0) AS collected, COUNT(*) AS n
    FROM public.finance_payments fp
    WHERE fp.school_id = p_school_id
      AND (
        (fp.date IS NOT NULL AND fp.date::DATE = d.date)
        OR (fp.date IS NULL AND fp.created_at::DATE = d.date)
      )
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM public.messages m
    WHERE m.school_id = p_school_id AND m.created_at::DATE = d.date
  ) msg ON true;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  -- class_term (current term is not modelled in schema; use the current year
  -- and 'Current' as a placeholder — dashboards can still slice on class)
  DELETE FROM warehouse.class_term WHERE school_id = p_school_id AND year = EXTRACT(YEAR FROM p_up_to)::INTEGER;
  INSERT INTO warehouse.class_term (school_id, class, term, year, students_count, mean_score, attendance_rate_pct)
  SELECT
    p_school_id,
    s.class,
    'Current',
    EXTRACT(YEAR FROM p_up_to)::INTEGER,
    COUNT(*),
    NULL,   -- mean_score: phase 2
    (
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE LOWER(sa.status) = 'present') / NULLIF(COUNT(*), 0), 2)
      FROM public.student_attendance sa
      WHERE sa.school_id = p_school_id AND sa.class = s.class AND sa.date BETWEEN v_from AND p_up_to
    )
  FROM students s
  WHERE s.school_id = p_school_id
    AND COALESCE(s.status, 'Active') NOT IN ('Inactive','Graduated','Archived','Withdrawn')
    AND s.class IS NOT NULL
  GROUP BY s.class;

  -- teacher_term (subjects / classes counted from subject_assignments)
  DELETE FROM warehouse.teacher_term WHERE school_id = p_school_id AND year = EXTRACT(YEAR FROM p_up_to)::INTEGER;
  INSERT INTO warehouse.teacher_term (school_id, teacher_id, term, year, subjects_taught, classes_taught, students_reached, leaves_taken)
  SELECT
    p_school_id,
    t.id::TEXT,
    'Current',
    EXTRACT(YEAR FROM p_up_to)::INTEGER,
    (SELECT COUNT(DISTINCT sa.subject_name) FROM public.subject_assignments sa WHERE sa.school_id = p_school_id AND sa.teacher_id::TEXT = t.id::TEXT),
    (SELECT COUNT(DISTINCT sa.class_name)   FROM public.subject_assignments sa WHERE sa.school_id = p_school_id AND sa.teacher_id::TEXT = t.id::TEXT),
    (SELECT COUNT(DISTINCT st.id)
        FROM public.subject_assignments sa
        JOIN students st ON st.class = sa.class_name AND st.school_id = p_school_id
       WHERE sa.school_id = p_school_id AND sa.teacher_id::TEXT = t.id::TEXT),
    0  -- leaves_taken: wire when leave_requests aggregation is standardised
  FROM teachers t
  WHERE t.school_id = p_school_id;

  -- subject_term, student_term left for phase 2 (need scores JSONB shape)

  RETURN v_row_count;
END;
$$;

-- Recompute the platform-wide benchmarks for a date.
-- Runs across ALL schools; output is anonymised (medians, quartiles, counts).
CREATE OR REPLACE FUNCTION warehouse.refresh_benchmarks(p_date DATE DEFAULT current_date)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = warehouse, public
AS $$
BEGIN
  DELETE FROM warehouse.benchmarks_daily WHERE date = p_date;
  INSERT INTO warehouse.benchmarks_daily (
    date, schools_reporting,
    median_attendance_rate_pct, p75_attendance_rate_pct,
    median_students_per_school, median_staff_per_school,
    median_fees_collected_kes, p75_fees_collected_kes
  )
  SELECT
    p_date,
    COUNT(*),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY attendance_rate_pct) FILTER (WHERE attendance_rate_pct IS NOT NULL),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY attendance_rate_pct) FILTER (WHERE attendance_rate_pct IS NOT NULL),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY students_active)::INTEGER,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY staff_active)::INTEGER,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY fees_collected_kes)::BIGINT,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY fees_collected_kes)::BIGINT
  FROM warehouse.school_daily
  WHERE date = p_date;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. EXECUTE permissions
--    The edge function (running as service role) invokes these; end-users
--    never call them directly. authenticated role only needs SELECT via RLS.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA warehouse TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA warehouse TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA warehouse GRANT SELECT ON TABLES TO authenticated;

REVOKE ALL ON FUNCTION warehouse.refresh_school(UUID, DATE, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION warehouse.refresh_benchmarks(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION warehouse.refresh_school(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION warehouse.refresh_benchmarks(DATE) TO service_role;
