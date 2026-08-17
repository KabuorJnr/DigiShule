-- =============================================================================
--  EduOne — Platform Super-Admin setup (Supabase SQL editor)
-- =============================================================================
--  Replaces the old hardcoded admin/admin123 login with a real Supabase account.
--  Platform-admin status lives in its own table (public.platform_admins), so we
--  never touch the app_role enum. The app sends anyone in that table to /admin
--  after a normal sign-in; everyone else goes to their portal.
--
--  Paste this whole file and run it once. Credentials created:
--      email / username : superadmin@edu1app.tech
--      password         : EduOne@Sup3r2026   (change it after first login)
-- =============================================================================

create extension if not exists pgcrypto;

-- 1. Who is allowed into /admin. Not self-serve — you add rows here yourself.
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.platform_admins enable row level security;
drop policy if exists "read own admin row" on public.platform_admins;
create policy "read own admin row" on public.platform_admins
  for select using (user_id = auth.uid());

-- 2. Create the super-admin auth user (idempotent) and mark it as a platform admin.
do $$
declare
  uid uuid;
  admin_email text := 'superadmin@edu1app.tech';
  admin_pass  text := 'EduOne@Sup3r2026';
begin
  select id into uid from auth.users where email = admin_email;

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at,
                            raw_app_meta_data, raw_user_meta_data)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            admin_email, crypt(admin_pass, gen_salt('bf')), now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Platform Super Admin"}'::jsonb);

    insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid,
            jsonb_build_object('sub', uid::text, 'email', admin_email),
            'email', admin_email, now(), now(), now());
  end if;

  -- Login needs a profiles row; use any valid enum value (admin access comes
  -- from platform_admins, not from this role).
  insert into public.profiles (id, username, full_name, role)
  values (uid, admin_email, 'Platform Super Admin', (enum_range(null::app_role))[1])
  on conflict (id) do nothing;

  insert into public.platform_admins (user_id) values (uid)
  on conflict (user_id) do nothing;
end $$;

-- verify (expect one row, is_super_admin = true):
select u.email, (pa.user_id is not null) as is_super_admin
from auth.users u
left join public.platform_admins pa on pa.user_id = u.id
where u.email = 'superadmin@edu1app.tech';

-- ─────────────────────────────────────────────────────────────────────────────
-- Fallback: if the auth.identities insert errors on "provider_id" (older
-- Supabase), create the user via Dashboard → Authentication → Add user
-- (Auto Confirm), then re-run just the two inserts inside the DO block above.
-- ─────────────────────────────────────────────────────────────────────────────
