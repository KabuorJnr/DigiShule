-- =============================================================================
--  EduOne — Platform Super-Admin setup (run ONCE in the Supabase SQL editor)
-- =============================================================================
--  This replaces the old hardcoded admin/admin123 login with a real Supabase
--  account. The app routes anyone whose profiles.role = 'super_admin' to the
--  /admin console after a normal sign-in.
--
--  Credentials created below (change them if you like, then use the new values):
--      email / username : superadmin@edu1app.tech
--      password         : EduOne@Sup3r2026
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. If profiles.role has a CHECK constraint, make sure 'super_admin' is allowed.
--    (Skip if role is a plain text column — most installs.)
--    Example:
--    alter table public.profiles drop constraint if exists profiles_role_check;
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Create the auth user.
--
--    RELIABLE PATH (recommended): use the Dashboard instead of this SQL block —
--      Authentication → Users → Add user →
--        email:    superadmin@edu1app.tech
--        password: EduOne@Sup3r2026
--        ✅ tick "Auto Confirm User"  →  Create user
--    Then skip straight to step 2.
--
--    SQL PATH (if you can't use the dashboard): uncomment and run this block.
--    Works on recent Supabase; if auth.identities errors on your version, use
--    the dashboard path above instead.
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   uid uuid := gen_random_uuid();
--   admin_email text := 'superadmin@edu1app.tech';
--   admin_pass  text := 'EduOne@Sup3r2026';
-- begin
--   insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
--                           email_confirmed_at, created_at, updated_at,
--                           raw_app_meta_data, raw_user_meta_data)
--   values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
--           admin_email, crypt(admin_pass, gen_salt('bf')), now(), now(), now(),
--           '{"provider":"email","providers":["email"]}'::jsonb,
--           '{"full_name":"Platform Super Admin","role":"super_admin"}'::jsonb);
--
--   insert into auth.identities (id, user_id, identity_data, provider, provider_id,
--                                last_sign_in_at, created_at, updated_at)
--   values (gen_random_uuid(), uid,
--           jsonb_build_object('sub', uid::text, 'email', admin_email),
--           'email', admin_email, now(), now(), now());
-- end $$;


-- ---------------------------------------------------------------------------
-- 2. Grant the super_admin role in profiles (run this regardless of path above).
--    If your profiles table has extra NOT NULL columns (e.g. school_id), add
--    them here or make them nullable for the platform admin.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, username, full_name, role)
select id, email, 'Platform Super Admin', 'super_admin'
from auth.users
where email = 'superadmin@edu1app.tech'
on conflict (id) do update set role = 'super_admin';


-- ---------------------------------------------------------------------------
-- 3. (Recommended, when you migrate the dashboard data to Supabase)
--    A helper for RLS policies so only platform admins can read all schools:
--
--    create or replace function public.is_super_admin() returns boolean
--      language sql security definer stable as $$
--        select exists (select 1 from public.profiles
--                       where id = auth.uid() and role = 'super_admin');
--      $$;
--
--    Then on your schools/subscriptions tables:
--      create policy "super admins read all" on public.schools
--        for select using ( public.is_super_admin() );
-- ---------------------------------------------------------------------------

-- Verify:
-- select u.email, p.role from auth.users u join public.profiles p on p.id = u.id
-- where p.role = 'super_admin';
