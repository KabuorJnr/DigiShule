-- =============================================================================
--  EduOne — Platform Super-Admin setup (Supabase SQL editor)
-- =============================================================================
--  Replaces the old hardcoded admin/admin123 login with a real Supabase account.
--  The app routes anyone whose profiles.role = 'super_admin' to the /admin
--  console after a normal sign-in.
--
--  Credentials created below (change the password after first login):
--      email / username : superadmin@edu1app.tech
--      password         : EduOne@Sup3r2026
--
--  profiles.role is an enum (app_role), so 'super_admin' must be added to the
--  enum FIRST — and Postgres will not let you add an enum value and use it in
--  the same transaction. Run STEP 1 on its own, then run STEP 2.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — run this line by itself first.
-- ─────────────────────────────────────────────────────────────────────────────
alter type app_role add value if not exists 'super_admin';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — run after STEP 1 succeeds.
-- Creates the auth user (idempotent) and grants the super_admin role.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

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
            '{"full_name":"Platform Super Admin","role":"super_admin"}'::jsonb);

    insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid,
            jsonb_build_object('sub', uid::text, 'email', admin_email),
            'email', admin_email, now(), now(), now());
  end if;

  insert into public.profiles (id, username, full_name, role)
  values (uid, admin_email, 'Platform Super Admin', 'super_admin')
  on conflict (id) do update set role = 'super_admin';
end $$;

-- verify (expect one row, role = super_admin):
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'superadmin@edu1app.tech';


-- ─────────────────────────────────────────────────────────────────────────────
-- Fallbacks
--   • If STEP 2 errors on "provider_id ... does not exist" (older Supabase):
--     create the user via Dashboard → Authentication → Users → Add user
--     (tick Auto Confirm), then run ONLY the `insert into public.profiles …
--     on conflict … set role = 'super_admin';` statement above.
--   • If it errors "null value in column … profiles": your profiles table has
--     an extra NOT NULL column (e.g. school_id) — add it to that insert.
-- ─────────────────────────────────────────────────────────────────────────────
