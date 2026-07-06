-- 024_fix_subqueries.sql
-- Fixes "more than one row returned by a subquery used as an expression" 
-- caused by the old my_school_id() function.

-- 1. Redefine my_school_id() to safely return exactly one row just in case any RPCs still use it.
CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Dynamically update ALL tables that might still be using the old my_school_id() policy.
DO $$
DECLARE
    tbl_name text;
BEGIN
    FOR tbl_name IN 
        SELECT relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relkind = 'r'
          AND c.relrowsecurity = true
    LOOP
        -- Check if table has a school_id column
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = tbl_name 
              AND column_name = 'school_id'
        ) THEN
            -- We just blindly drop and recreate the standard policy to ensure it uses ANY(my_school_ids())
            EXECUTE format('DROP POLICY IF EXISTS "school isolation" ON %I;', tbl_name);
            
            EXECUTE format('
                CREATE POLICY "school isolation" ON %I
                FOR ALL USING (school_id = ANY(my_school_ids()))
                WITH CHECK (school_id = ANY(my_school_ids()));
            ', tbl_name);
        END IF;
    END LOOP;
END $$;

-- 3. Also fix the `schools` table which had uniquely named policies
DROP POLICY IF EXISTS "school members read own school" ON schools;
CREATE POLICY "school members read own school"
  ON schools FOR SELECT
  USING (id = ANY(my_school_ids()));

DROP POLICY IF EXISTS "school admins update school" ON schools;
CREATE POLICY "school admins update school"
  ON schools FOR UPDATE
  USING (id = ANY(my_school_ids()));
