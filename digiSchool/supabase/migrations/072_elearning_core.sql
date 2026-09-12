-- 072_elearning_core.sql
-- E-Learning portal, phase 1: the data floor.
--
-- Replaces the localStorage-only catalog in src/lib/elearningStore.js with a
-- real content graph (course -> unit -> lesson -> block), Postgres-backed live
-- sessions, and an append-only event log that all progress/mastery is derived
-- from. Quizzes and attempts land in a later migration; the event log is here
-- now because it is the one thing that cannot be retrofitted -- once progress
-- is stored as mutable rows you can never recompute it after a scoring fix.
--
-- Course/unit/lesson ids are deterministic (see src/lib/elearningAccess.js),
-- so regenerating a course from schemes_of_work is idempotent and never
-- orphans a student's progress.

-- ---------------------------------------------------------------------------
-- 1. Helper functions
--    Multi-profile safe, in the same style as is_staff() / linked_student_id()
--    from 070_fix_is_staff_multi_profile.sql.
-- ---------------------------------------------------------------------------

-- Every student the caller may act for: their own record, plus a parent's
-- linked children (profiles.linked_students, added in 043).
CREATE OR REPLACE FUNCTION public.my_student_ids()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  WITH own AS (
    SELECT p.student_id AS sid
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.student_id IS NOT NULL
  ),
  children AS (
    SELECT (elem ->> 'id') AS sid
    FROM public.profiles p,
         LATERAL jsonb_array_elements(COALESCE(p.linked_students, '[]'::jsonb)) AS elem
    WHERE p.id = auth.uid()
      AND jsonb_typeof(COALESCE(p.linked_students, '[]'::jsonb)) = 'array'
  )
  SELECT COALESCE(array_agg(DISTINCT t.sid), ARRAY[]::text[])
  FROM (SELECT sid FROM own UNION SELECT sid FROM children) t
  WHERE t.sid IS NOT NULL;
$fn$;

-- The classes those students sit in -- the visibility scope for a student or parent.
CREATE OR REPLACE FUNCTION public.my_classes()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(array_agg(DISTINCT s.class), ARRAY[]::text[])
  FROM public.students s
  WHERE s.class IS NOT NULL
    AND s.id = ANY (public.my_student_ids());
$fn$;

-- The RLS mirror of canSee() in src/lib/elearningAccess.js. Keep the two in
-- step: the JS copy drives the UI, this one is the actual boundary.
CREATE OR REPLACE FUNCTION public.can_see_elearning(
  p_class text,
  p_state text,
  p_available_from timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    public.is_staff()
    OR (
      (
        COALESCE(p_class, 'All') IN ('All', 'All Classes')
        OR p_class = ANY (public.my_classes())
      )
      AND (
        p_state = 'published'
        OR (p_state = 'scheduled' AND p_available_from IS NOT NULL AND p_available_from <= now())
      )
    );
$fn$;

-- Shared updated_at trigger for the tables below.
CREATE OR REPLACE FUNCTION public.elearning_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Content graph
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS elearning_courses (
  id              text primary key,              -- deterministic: courseUid(school, class, subject, term)
  school_id       uuid not null references schools(id) on delete cascade,
  class           text not null,
  subject         text not null,
  term            text not null,
  title           text,
  state           text not null default 'draft'
                    check (state in ('draft','scheduled','published','archived')),
  available_from  timestamptz,
  generated_at    timestamptz,
  generated_from  text default 'schemes_of_work',
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS elearning_units (
  id          text primary key,                  -- deterministic: unitUid(course, strand)
  course_id   text not null references elearning_courses(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  ord         int not null default 0,
  strand      text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

CREATE TABLE IF NOT EXISTS elearning_lessons (
  id                     text primary key,       -- deterministic: lessonUid(school, class, subject, term, strand, sub_strand)
  unit_id                text not null references elearning_units(id) on delete cascade,
  course_id              text not null references elearning_courses(id) on delete cascade,
  school_id              uuid not null references schools(id) on delete cascade,
  -- class/subject denormalised from the course so RLS and the student feed
  -- never need a join.
  class                  text not null,
  subject                text not null,
  term                   text not null,
  strand                 text,
  sub_strand             text not null,
  title                  text,
  ord                    int not null default 0,
  week_number            int,
  outcomes               text[],
  key_inquiry_questions  text,
  learning_resources     text,
  assessment_method      text,
  state                  text not null default 'draft'
                           check (state in ('draft','scheduled','published','archived')),
  available_from         timestamptz,
  pass_mark              numeric not null default 50,
  -- 'auto' rows are rewritten by the course generator; 'manual' rows are a
  -- teacher's edit and are never overwritten by a regeneration.
  origin                 text not null default 'auto' check (origin in ('auto','manual')),
  created_by             uuid,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

CREATE TABLE IF NOT EXISTS elearning_blocks (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     text not null references elearning_lessons(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  ord           int not null default 0,
  kind          text not null
                  check (kind in ('video','doc','link','live_session','quiz','assignment','note')),
  title         text not null,
  storage_path  text,                            -- {school_id}/elearning/{lesson_id}/{block_id}.{ext}
  url           text,
  file_id       text,                            -- file_metadata.id when sourced from the existing library
  session_id    uuid,                            -- set for kind='live_session'
  meta          jsonb not null default '{}'::jsonb,
  required      boolean not null default false,
  origin        text not null default 'auto' check (origin in ('auto','manual')),
  created_by    uuid,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 3. Live sessions (replaces the localStorage catalog)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS elearning_live_sessions (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  lesson_id     text references elearning_lessons(id) on delete set null,
  subject       text not null,
  class         text not null default 'All',
  title         text not null,
  description   text,
  host_id       uuid,
  host_name     text,
  provider      text default 'other' check (provider in ('meet','zoom','teams','other')),
  join_url      text,
  resource_url  text,
  start_at      timestamptz,
  end_at        timestamptz,
  state         text not null default 'scheduled'
                  check (state in ('scheduled','live','ended','cancelled')),
  created_by    uuid,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

CREATE TABLE IF NOT EXISTS elearning_live_attendance (
  session_id       uuid not null references elearning_live_sessions(id) on delete cascade,
  student_id       text not null,
  school_id        uuid not null references schools(id) on delete cascade,
  first_join       timestamptz,
  last_leave       timestamptz,
  minutes_present  numeric not null default 0,
  presence_pct     numeric not null default 0,
  status           text not null default 'absent'
                     check (status in ('present','late','absent','excused')),
  -- 'derived' comes from join/leave events; 'manual' is a teacher's roster mark
  -- and wins over a later derivation.
  source           text not null default 'derived' check (source in ('derived','manual')),
  marked_by        uuid,
  updated_at       timestamptz default now(),
  primary key (session_id, student_id)
);

-- ---------------------------------------------------------------------------
-- 4. Append-only event log + derived mastery cache
-- ---------------------------------------------------------------------------

-- id is CLIENT-generated so an offline queue can be replayed any number of
-- times without duplicating rows (insert ... on conflict do nothing). There is
-- deliberately no UPDATE or DELETE policy on this table.
CREATE TABLE IF NOT EXISTS elearning_events (
  id           uuid primary key,
  school_id    uuid not null references schools(id) on delete cascade,
  student_id   text not null,
  lesson_id    text references elearning_lessons(id) on delete cascade,
  block_id     uuid references elearning_blocks(id) on delete set null,
  session_id   uuid references elearning_live_sessions(id) on delete set null,
  kind         text not null
                 check (kind in ('view','progress','complete','attempt','join','leave')),
  subject      text,
  strand       text,
  score        numeric,
  max_score    numeric,
  difficulty   numeric not null default 1.0,
  meta         jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz default now()
);

-- Derived cache only. Must always be rebuildable from elearning_events via
-- rebuild_elearning_mastery() -- never treat it as a source of truth.
CREATE TABLE IF NOT EXISTS elearning_mastery (
  school_id        uuid not null references schools(id) on delete cascade,
  student_id       text not null,
  subject          text not null,
  strand           text not null,
  m                numeric not null default 0.5,   -- EWMA mastery in [0,1]
  n                int not null default 0,         -- graded attempts seen
  last_attempt_at  timestamptz,
  updated_at       timestamptz default now(),
  primary key (school_id, student_id, subject, strand)
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS elearning_courses_lookup_idx
  ON elearning_courses (school_id, class, subject, term);
CREATE INDEX IF NOT EXISTS elearning_units_course_idx
  ON elearning_units (course_id, ord);
CREATE INDEX IF NOT EXISTS elearning_lessons_course_idx
  ON elearning_lessons (course_id, ord);
CREATE INDEX IF NOT EXISTS elearning_lessons_feed_idx
  ON elearning_lessons (school_id, class, state, week_number);
CREATE INDEX IF NOT EXISTS elearning_blocks_lesson_idx
  ON elearning_blocks (lesson_id, ord);
CREATE INDEX IF NOT EXISTS elearning_live_sessions_feed_idx
  ON elearning_live_sessions (school_id, start_at DESC);
CREATE INDEX IF NOT EXISTS elearning_live_attendance_student_idx
  ON elearning_live_attendance (school_id, student_id);
CREATE INDEX IF NOT EXISTS elearning_events_student_idx
  ON elearning_events (school_id, student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS elearning_events_lesson_idx
  ON elearning_events (lesson_id, kind);
CREATE INDEX IF NOT EXISTS elearning_events_rebuild_idx
  ON elearning_events (school_id, student_id, subject, strand, occurred_at);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'elearning_courses','elearning_units','elearning_lessons','elearning_blocks',
    'elearning_live_sessions','elearning_live_attendance','elearning_mastery'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.elearning_touch_updated_at()',
      t || '_touch', t
    );
  END LOOP;
END $do$;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    Staff read/write within their school (subject-class scoping for teachers
--    is enforced in the app via teacherPermissions.js -- the DB boundary here
--    is the school). Students and parents get read-only access to live content
--    for their own class, and may only append their own events.
-- ---------------------------------------------------------------------------

ALTER TABLE elearning_courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_units            ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_live_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_live_attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE elearning_mastery          ENABLE ROW LEVEL SECURITY;

-- courses
DROP POLICY IF EXISTS "read courses" ON elearning_courses;
CREATE POLICY "read courses" ON elearning_courses
  FOR SELECT USING (
    school_id = my_school_id()
    AND can_see_elearning(class, state, available_from)
  );

DROP POLICY IF EXISTS "staff write courses" ON elearning_courses;
CREATE POLICY "staff write courses" ON elearning_courses
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- units (visibility follows the parent course)
DROP POLICY IF EXISTS "read units" ON elearning_units;
CREATE POLICY "read units" ON elearning_units
  FOR SELECT USING (
    school_id = my_school_id()
    AND EXISTS (
      SELECT 1 FROM elearning_courses c
      WHERE c.id = elearning_units.course_id
        AND can_see_elearning(c.class, c.state, c.available_from)
    )
  );

DROP POLICY IF EXISTS "staff write units" ON elearning_units;
CREATE POLICY "staff write units" ON elearning_units
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- lessons
DROP POLICY IF EXISTS "read lessons" ON elearning_lessons;
CREATE POLICY "read lessons" ON elearning_lessons
  FOR SELECT USING (
    school_id = my_school_id()
    AND can_see_elearning(class, state, available_from)
  );

DROP POLICY IF EXISTS "staff write lessons" ON elearning_lessons;
CREATE POLICY "staff write lessons" ON elearning_lessons
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- blocks (visibility follows the parent lesson)
DROP POLICY IF EXISTS "read blocks" ON elearning_blocks;
CREATE POLICY "read blocks" ON elearning_blocks
  FOR SELECT USING (
    school_id = my_school_id()
    AND EXISTS (
      SELECT 1 FROM elearning_lessons l
      WHERE l.id = elearning_blocks.lesson_id
        AND can_see_elearning(l.class, l.state, l.available_from)
    )
  );

DROP POLICY IF EXISTS "staff write blocks" ON elearning_blocks;
CREATE POLICY "staff write blocks" ON elearning_blocks
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- live sessions: cancelled sessions stay visible to staff only.
DROP POLICY IF EXISTS "read live sessions" ON elearning_live_sessions;
CREATE POLICY "read live sessions" ON elearning_live_sessions
  FOR SELECT USING (
    school_id = my_school_id()
    AND (
      is_staff()
      OR (
        (COALESCE(class, 'All') IN ('All', 'All Classes') OR class = ANY (my_classes()))
        AND state <> 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "staff write live sessions" ON elearning_live_sessions;
CREATE POLICY "staff write live sessions" ON elearning_live_sessions
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- live attendance: a student/parent sees only their own rows.
DROP POLICY IF EXISTS "read live attendance" ON elearning_live_attendance;
CREATE POLICY "read live attendance" ON elearning_live_attendance
  FOR SELECT USING (
    school_id = my_school_id()
    AND (is_staff() OR student_id = ANY (my_student_ids()))
  );

DROP POLICY IF EXISTS "staff write live attendance" ON elearning_live_attendance;
CREATE POLICY "staff write live attendance" ON elearning_live_attendance
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- events: append-only. Students insert their own; staff insert on behalf of a
-- student (marking a roster). No UPDATE/DELETE policy exists by design.
DROP POLICY IF EXISTS "read events" ON elearning_events;
CREATE POLICY "read events" ON elearning_events
  FOR SELECT USING (
    school_id = my_school_id()
    AND (is_staff() OR student_id = ANY (my_student_ids()))
  );

DROP POLICY IF EXISTS "append events" ON elearning_events;
CREATE POLICY "append events" ON elearning_events
  FOR INSERT WITH CHECK (
    school_id = my_school_id()
    AND (is_staff() OR student_id = ANY (my_student_ids()))
  );

-- mastery: readable by the student/parent it belongs to, written by staff and
-- by the rebuild function.
DROP POLICY IF EXISTS "read mastery" ON elearning_mastery;
CREATE POLICY "read mastery" ON elearning_mastery
  FOR SELECT USING (
    school_id = my_school_id()
    AND (is_staff() OR student_id = ANY (my_student_ids()))
  );

DROP POLICY IF EXISTS "staff write mastery" ON elearning_mastery;
CREATE POLICY "staff write mastery" ON elearning_mastery
  FOR ALL USING (school_id = my_school_id() AND is_staff())
  WITH CHECK (school_id = my_school_id() AND is_staff());

-- ---------------------------------------------------------------------------
-- 8. Mastery rebuild (the fold that makes elearning_mastery disposable)
--
--    m' = a*(score*difficulty) + (1-a)*m,  a = max(0.2, 1/(n+1))
--
--    Early attempts move the estimate fast, later ones settle it. Time decay
--    is applied at read time, not here, so the stored value stays a pure
--    function of the event log.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rebuild_elearning_mastery(
  p_school_id uuid,
  p_student_id text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r       record;
  v_m     numeric;
  v_n     int;
  v_alpha numeric;
  v_key   text := '';
  v_rows  int := 0;
BEGIN
  DELETE FROM elearning_mastery
  WHERE school_id = p_school_id
    AND (p_student_id IS NULL OR student_id = p_student_id);

  FOR r IN
    SELECT student_id, subject, strand, score, max_score, difficulty, occurred_at
    FROM elearning_events
    WHERE school_id = p_school_id
      AND kind = 'attempt'
      AND subject IS NOT NULL
      AND strand IS NOT NULL
      AND score IS NOT NULL
      AND max_score IS NOT NULL
      AND max_score > 0
      AND (p_student_id IS NULL OR student_id = p_student_id)
    ORDER BY student_id, subject, strand, occurred_at, id
  LOOP
    IF v_key IS DISTINCT FROM (r.student_id || '|' || r.subject || '|' || r.strand) THEN
      v_key := r.student_id || '|' || r.subject || '|' || r.strand;
      v_m := 0.5;
      v_n := 0;
    END IF;

    v_alpha := GREATEST(0.2, 1.0 / (v_n + 1));
    v_m := v_alpha * LEAST(1.0, (r.score / r.max_score) * COALESCE(r.difficulty, 1.0))
           + (1 - v_alpha) * v_m;
    v_n := v_n + 1;

    INSERT INTO elearning_mastery (school_id, student_id, subject, strand, m, n, last_attempt_at)
    VALUES (p_school_id, r.student_id, r.subject, r.strand, v_m, v_n, r.occurred_at)
    ON CONFLICT (school_id, student_id, subject, strand)
    DO UPDATE SET m = EXCLUDED.m,
                  n = EXCLUDED.n,
                  last_attempt_at = EXCLUDED.last_attempt_at,
                  updated_at = now();
    v_rows := v_rows + 1;
  END LOOP;

  RETURN v_rows;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.my_student_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_elearning(text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_elearning_mastery(uuid, text) TO authenticated;
