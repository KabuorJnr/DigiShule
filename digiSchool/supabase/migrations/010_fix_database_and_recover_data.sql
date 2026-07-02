-- ==============================================================================
-- Migration 010: Fix Database and Recover Data
-- Resolves multi-tenant data loss issues by backfilling NULL school_ids
-- Re-writes RLS policies to support users belonging to multiple schools
-- ==============================================================================

-- 1. Create a Default School if none exists, and store its ID in a variable
DO $$
DECLARE
    v_default_school_id UUID;
BEGIN
    -- Try to find an existing school first (take the oldest one)
    SELECT id INTO v_default_school_id FROM schools ORDER BY id ASC LIMIT 1;

    -- If no school exists at all, create one
    IF v_default_school_id IS NULL THEN
        INSERT INTO schools (name, motto, type) 
        VALUES ('DigiShule Default System', 'Learning For All', 'Default System')
        RETURNING id INTO v_default_school_id;
    END IF;

    -- 2. Backfill ALL old records that have a NULL school_id
    -- This brings back the "lost" data instantly
    
    UPDATE profiles SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE app_config SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE students SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE teachers SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE timetables SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE exam_schedules SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE exam_sessions SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE library_books SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE library_loans SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE finance_payments SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE fee_summary SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE admissions SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE clinic_visits SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE disciplinary_records SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE staff SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE facilities SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE notifications SET school_id = v_default_school_id WHERE school_id IS NULL;
    UPDATE file_metadata SET school_id = v_default_school_id WHERE school_id IS NULL;
END $$;

-- 3. Replace my_school_id() with my_school_ids() returning an array
CREATE OR REPLACE FUNCTION my_school_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT array_agg(school_id) FROM profiles WHERE id = auth.uid();
$func$;

-- 4. Update the RLS Policy on schools table
DROP POLICY IF EXISTS "school members read own school" ON schools;
CREATE POLICY "school members read own school"
  ON schools FOR SELECT
  USING (id = ANY(my_school_ids()));

DROP POLICY IF EXISTS "school admins update school" ON schools;
CREATE POLICY "school admins update school"
  ON schools FOR UPDATE
  USING (id = ANY(my_school_ids()));

-- 5. Update RLS Policies on all data tables to use = ANY(my_school_ids())
DO $$
DECLARE
    tbl_name text;
BEGIN
    FOR tbl_name IN 
        SELECT unnest(ARRAY[
            'students', 'teachers', 'timetables', 'exam_schedules', 'exam_sessions',
            'app_config', 'library_books', 'library_loans', 'finance_payments',
            'fee_summary', 'admissions', 'clinic_visits', 'disciplinary_records',
            'staff', 'facilities', 'notifications', 'file_metadata'
        ])
    LOOP
        -- Drop the old policy
        EXECUTE format('DROP POLICY IF EXISTS "school isolation" ON %I;', tbl_name);
        
        -- Create the new array-based policy
        EXECUTE format('
            CREATE POLICY "school isolation" ON %I
            FOR ALL USING (school_id = ANY(my_school_ids()))
            WITH CHECK (school_id = ANY(my_school_ids()));
        ', tbl_name);
    END LOOP;
END $$;

-- 6. Apply the Primary Key fixes for Profiles from migration 009
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_id UUID DEFAULT gen_random_uuid();

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
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_id_pkey PRIMARY KEY (profile_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND constraint_name = 'unique_user_school_role'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT unique_user_school_role UNIQUE (id, school_id, role);
    END IF;
END $$;

-- 7. Fix get_user_id_by_email RPC using safe syntax ($func$ instead of $$)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  RETURN v_id;
END;
$func$;
