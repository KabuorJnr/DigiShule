-- DigiShule initial schema
-- School-management portal. All application tables live in `public`.
-- Auth is handled by Supabase Auth (auth.users); `public.profiles` extends a
-- user with a username, role and links to seeded teacher/student records.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Roles & profiles
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'principal', 'deputy_academic', 'deputy_admin', 'finance', 'registrar',
  'librarian', 'teacher', 'student', 'parent', 'nurse'
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    citext unique not null,
  full_name   text not null,
  role        public.app_role not null,
  dept        text,
  teacher_id  text,
  student_id  text,
  created_at  timestamptz not null default now()
);

-- Returns the role of the currently authenticated user (security definer so it
-- can read profiles regardless of RLS). Used by policies and the client.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- True when the caller is staff (anyone who is not a student/parent).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role not in ('student', 'parent') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Resolve a (case-insensitive) username to its auth email so the login form can
-- keep its username UX while signing in with Supabase email/password auth.
-- Security definer + restricted search_path; returns only the email string.
create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username
  order by p.created_at
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Singleton application config (school settings, boundaries, fees, toggles,
-- exam venues). One row, id = 1.
-- ---------------------------------------------------------------------------
create table public.app_config (
  id               smallint primary key default 1 check (id = 1),
  settings         jsonb not null default '{}'::jsonb,
  grade_boundaries jsonb not null default '[]'::jsonb,
  fee_structure    jsonb not null default '[]'::jsonb,
  notif_toggles    jsonb not null default '{}'::jsonb,
  venues           jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Academic core
-- ---------------------------------------------------------------------------
create table public.teachers (
  id          text primary key,
  name        text not null,
  subject     text,
  department  text,
  status      text not null default 'active'
);

create table public.students (
  id       text primary key,
  name     text not null,
  adm      text unique not null,
  class    text not null,
  gender   text,
  scores   jsonb not null default '{}'::jsonb,
  flagged  boolean not null default false
);
create index students_class_idx on public.students (class);

create table public.exam_schedules (
  id         text primary key,
  name       text not null,
  type       text,
  start_date date,
  end_date   date
);

create table public.exam_sessions (
  id           text primary key,
  exam_id      text not null references public.exam_schedules (id) on delete cascade,
  date         date,
  classes      text,
  subject      text,
  start_time   text,
  end_time     text,
  venue        text,
  invigilator  text,
  status       text not null default 'Upcoming'
);
create index exam_sessions_exam_idx on public.exam_sessions (exam_id);

-- Timetables are stored per class as the grid payload the UI builds.
create table public.timetables (
  class       text primary key,
  term        text,
  data        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Operational modules
-- ---------------------------------------------------------------------------
create table public.library_books (
  id         text primary key,
  title      text not null,
  author     text,
  isbn       text,
  category   text,
  copies     integer not null default 0,
  available  integer not null default 0
);

create table public.library_loans (
  id        text primary key,
  book      text not null,
  student   text,
  adm       text,
  borrowed  date,
  due       date,
  status    text not null default 'Borrowed'
);

create table public.finance_payments (
  id       text primary key,
  date     date,
  student  text,
  adm      text,
  method   text,
  ref      text,
  amount   numeric not null default 0
);

create table public.fee_summary (
  form       text primary key,
  billed     numeric not null default 0,
  students   integer not null default 0,
  collected  numeric not null default 0,
  expected   numeric not null default 0
);

create table public.admissions (
  id      text primary key,
  name    text not null,
  kcpe    integer,
  gender  text,
  form    text,
  date    date,
  status  text not null default 'Pending'
);

create table public.clinic_visits (
  id         text primary key,
  date       date,
  student    text,
  adm        text,
  complaint  text,
  treatment  text,
  outcome    text
);

create table public.staff (
  id        text primary key,
  name      text not null,
  role      text,
  dept      text,
  status    text not null default 'Present',
  check_in  text
);

create table public.disciplinary_records (
  id           text primary key,
  date         date,
  student      text,
  adm          text,
  class        text,
  category     text,
  description  text,
  action       text,
  severity     text not null default 'Low',
  status       text not null default 'Open'
);
create index disciplinary_records_adm_idx on public.disciplinary_records (adm);

create table public.facilities (
  id        text primary key,
  name      text not null,
  type      text,
  capacity  integer not null default 0,
  status    text not null default 'Operational',
  note      text
);

create table public.notifications (
  id          text primary key,
  title       text not null,
  body        text,
  time        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Model: every authenticated user may READ reference data (the portal shells
-- need it). WRITES are restricted to staff (non student/parent). Profiles are
-- self-readable; the singleton config is staff-writable.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.app_config        enable row level security;
alter table public.teachers          enable row level security;
alter table public.students          enable row level security;
alter table public.exam_schedules    enable row level security;
alter table public.exam_sessions     enable row level security;
alter table public.timetables        enable row level security;
alter table public.library_books     enable row level security;
alter table public.library_loans     enable row level security;
alter table public.finance_payments  enable row level security;
alter table public.fee_summary       enable row level security;
alter table public.admissions        enable row level security;
alter table public.clinic_visits     enable row level security;
alter table public.staff             enable row level security;
alter table public.disciplinary_records enable row level security;
alter table public.facilities        enable row level security;
alter table public.notifications     enable row level security;

-- profiles: a user can read their own profile; staff can read all profiles.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

-- The student record linked to the caller's profile (parent or student
-- accounts). Security definer so policies can resolve it regardless of RLS.
create or replace function public.linked_student_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select student_id from public.profiles where id = auth.uid();
$$;

-- The admission number of the caller's linked student. Used to scope a
-- parent/student to their own child's operational records.
create or replace function public.linked_adm()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.adm
  from public.students s
  join public.profiles p on p.student_id = s.id
  where p.id = auth.uid();
$$;

-- Reference / domain tables: readable by any authenticated user, writable by
-- staff. The sensitive, per-child tables below are excluded here and get
-- narrower SELECT policies so a parent/student only sees their own child.
do $$
declare t text;
begin
  foreach t in array array[
    'app_config','teachers','exam_schedules','exam_sessions',
    'timetables','library_books','fee_summary','admissions','staff',
    'facilities','notifications'
  ] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all to authenticated using (public.is_staff()) with check (public.is_staff());', t);
  end loop;

  -- Writes on the per-child tables are still staff-only.
  foreach t in array array[
    'students','library_loans','finance_payments','clinic_visits','disciplinary_records'
  ] loop
    execute format(
      'create policy %1$s_write on public.%1$s for all to authenticated using (public.is_staff()) with check (public.is_staff());', t);
  end loop;
end $$;

-- Per-child SELECT policies: staff see everything; a parent/student sees only
-- the record(s) tied to their own linked student.
create policy students_select on public.students
  for select to authenticated
  using (public.is_staff() or id = public.linked_student_id());

create policy library_loans_select on public.library_loans
  for select to authenticated
  using (public.is_staff() or adm = public.linked_adm());

create policy finance_payments_select on public.finance_payments
  for select to authenticated
  using (public.is_staff() or adm = public.linked_adm());

create policy clinic_visits_select on public.clinic_visits
  for select to authenticated
  using (public.is_staff() or adm = public.linked_adm());

create policy disciplinary_records_select on public.disciplinary_records
  for select to authenticated
  using (public.is_staff() or adm = public.linked_adm());

-- Class position for the caller's linked student. Security definer so a
-- student can see their own rank without being able to read classmates' rows.
-- Returns the 1-based position (by overall average, descending) and class size.
create or replace function public.my_class_rank()
returns table(student_position int, class_size int)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select s.id, s.class
    from public.students s
    join public.profiles p on p.student_id = s.id
    where p.id = auth.uid()
  ),
  scored as (
    select s.id,
      avg(
        ( coalesce((sub.value->>'cat1')::numeric, 0)
        + coalesce((sub.value->>'cat2')::numeric, 0)
        + coalesce((sub.value->>'midterm')::numeric, 0)
        + coalesce((sub.value->>'endterm')::numeric, 0)
        ) / 260.0 * 100
      ) as overall
    from public.students s
    cross join lateral jsonb_each(s.scores) as sub(key, value)
    where s.class = (select class from me)
    group by s.id
  ),
  ranked as (
    select id,
      rank() over (order by overall desc) as rnk,
      count(*) over () as cnt
    from scored
  )
  select r.rnk::int, r.cnt::int
  from ranked r
  where r.id = (select id from me);
$$;
