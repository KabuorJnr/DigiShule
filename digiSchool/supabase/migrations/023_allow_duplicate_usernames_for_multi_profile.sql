-- 023_allow_duplicate_usernames_for_multi_profile.sql
-- Removes the UNIQUE constraint on the 'username' column in the profiles table.
-- Because one person (with one authentication account) can have multiple profiles (e.g. Teacher AND Parent),
-- they will naturally have multiple rows in the profiles table that share the exact same username.
-- The global uniqueness of the username is already safely enforced by the auth.users table (via email/dummy email).

DO $$
DECLARE
    v_constraint_name text;
BEGIN
    -- Find the exact name of the unique constraint on the username column
    SELECT constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%username%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END IF;
END $$;

-- Also explicitly drop the standard name just in case
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
