-- 013_rls_audit_fix.sql
-- Automatically identifies and secures all public tables lacking Row Level Security

DO $$
DECLARE
    tbl record;
    has_school_id boolean;
BEGIN
    FOR tbl IN 
        SELECT c.relname 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' 
          AND c.relkind = 'r' 
          AND NOT c.relrowsecurity
          AND c.relname NOT IN ('schema_migrations')
    LOOP
        -- Enable RLS for the table
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.relname);
        RAISE NOTICE 'Enabled RLS for table: %', tbl.relname;

        -- Check if table has a school_id column
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = tbl.relname 
              AND column_name = 'school_id'
        ) INTO has_school_id;

        IF has_school_id THEN
            -- Drop existing policy if it somehow exists (to prevent errors)
            EXECUTE format('DROP POLICY IF EXISTS "school isolation" ON public.%I;', tbl.relname);
            
            -- Create the standard school isolation policy
            EXECUTE format('
                CREATE POLICY "school isolation" ON public.%I
                FOR ALL USING (school_id = ANY(my_school_ids()))
                WITH CHECK (school_id = ANY(my_school_ids()));
            ', tbl.relname);
            
            RAISE NOTICE 'Created "school isolation" policy for table: %', tbl.relname;
        ELSE
            -- For tables without school_id (e.g. system/config tables)
            -- Leaving them with RLS enabled but no policies effectively defaults them to DENY ALL.
            -- This ensures no data leaks happen accidentally.
            RAISE NOTICE 'Table % does not have school_id. RLS enabled with default DENY ALL.', tbl.relname;
        END IF;
    END LOOP;
END $$;
