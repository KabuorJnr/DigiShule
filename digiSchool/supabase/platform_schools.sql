-- =============================================================================
--  EduOne — Phase 4: platform school registry (Supabase)
-- =============================================================================
--  Backs the /admin dashboard and the onboarding queue with real data.
--  Every school the platform tracks is one row here: pending sign-ups, active
--  (approved) schools, and rejected ones. Run once (after superadmin_setup.sql).
-- =============================================================================

create extension if not exists pgcrypto;

-- Helper: is the current user a platform admin? (used by the policies below)
create or replace function public.is_platform_admin()
  returns boolean language sql security definer stable set search_path = public as $$
    select exists (select 1 from public.platform_admins where user_id = auth.uid());
  $$;

create table if not exists public.school_onboarding (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  principal     text,
  email         text,
  phone         text,
  county        text,
  plan          text not null default 'standard' check (plan in ('starter','standard','premium')),
  students      int  not null default 0,
  status        text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  last_activity timestamptz default now()
);

alter table public.school_onboarding enable row level security;

grant insert on public.school_onboarding to anon, authenticated;
grant select, update on public.school_onboarding to authenticated;

-- Anyone signing up may file a PENDING request (and nothing else).
drop policy if exists "anyone can request onboarding" on public.school_onboarding;
create policy "anyone can request onboarding" on public.school_onboarding
  for insert to anon, authenticated with check (status = 'pending');

-- Platform admins can see and manage every row.
drop policy if exists "admins read onboarding" on public.school_onboarding;
create policy "admins read onboarding" on public.school_onboarding
  for select using (public.is_platform_admin());

drop policy if exists "admins update onboarding" on public.school_onboarding;
create policy "admins update onboarding" on public.school_onboarding
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Optional seed so the dashboard is populated on day one (only runs if empty).
insert into public.school_onboarding
  (name, principal, email, phone, county, plan, students, status, created_at, activated_at, last_activity)
select * from (values
  ('Greenhill Academy','J. Otieno','admin@greenhill.ac.ke','+254712000001','Nairobi','premium',812,'active', now()-interval '240 days', now()-interval '240 days', now()),
  ('Riverside High','M. Wanjiru','admin@riverside.sc.ke','+254712000002','Nakuru','standard',540,'active', now()-interval '180 days', now()-interval '180 days', now()-interval '1 day'),
  ('St. Mary''s Girls','A. Njoroge','admin@stmarys.ac.ke','+254712000003','Kisumu','standard',610,'active', now()-interval '150 days', now()-interval '150 days', now()),
  ('Sunrise Junior','P. Kamau','admin@sunrise.ac.ke','+254712000004','Mombasa','starter',220,'active', now()-interval '95 days', now()-interval '95 days', now()-interval '2 days'),
  ('Highview School','L. Achieng','admin@highview.ac.ke','+254712000005','Eldoret','premium',1050,'active', now()-interval '300 days', now()-interval '300 days', now()),
  ('Bright Future Academy','D. Mutua','admin@brightfuture.ac.ke','+254712000006','Machakos','starter',180,'active', now()-interval '60 days', now()-interval '60 days', now()-interval '3 days'),
  ('Victory Springs School','R. Cherono','admin@victorysprings.ac.ke','+254712000007','Kericho','standard',430,'pending', now()-interval '1 day', null, now()-interval '1 day'),
  ('Nova Learning Centre','S. Barasa','admin@novalearning.ac.ke','+254712000008','Kakamega','premium',760,'pending', now(), null, now())
) as v(name,principal,email,phone,county,plan,students,status,created_at,activated_at,last_activity)
where not exists (select 1 from public.school_onboarding);
