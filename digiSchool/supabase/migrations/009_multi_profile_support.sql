-- Migration 009: Multi-Profile Support
-- Drops the primary key constraint on the `id` column (which is auth.users.id)
-- Adds a surrogate primary key `profile_id` to allow a single user to have multiple roles/schools.

-- 1. Add new UUID column for surrogate key
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_id UUID DEFAULT gen_random_uuid();

-- 2. Drop the existing primary key constraint on `id`
-- Since constraint names might vary depending on how they were created, we do this dynamically:
DO $$
DECLARE
    v_constraint_name text;
BEGIN
    SELECT constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_type = 'PRIMARY KEY';

    IF v_constraint_name IS NOT NULL AND v_constraint_name != 'profiles_profile_id_pkey' THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(v_constraint_name);
    END IF;
END $$;

-- 3. Set the new primary key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_id_pkey PRIMARY KEY (profile_id);
    END IF;
END $$;

-- 4. Add unique constraint to prevent duplicate identical roles per school per user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND constraint_name = 'unique_user_school_role'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT unique_user_school_role UNIQUE (id, school_id, role);
    END IF;
END $$;

-- 5. RPC to get user id by email (SECURITY DEFINER to query auth.users)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
