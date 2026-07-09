-- 044_fix_finance_payments_rls.sql
-- Fixes RLS on finance_payments to use the latest ANY(my_school_ids()) format
-- This fixes the issue where Admin/Bursar updates (like Payment Verification) silently fail
-- because their school_id match fails under the old scalar my_school_id() function.

DO $$
BEGIN
    DROP POLICY IF EXISTS "school isolation" ON public.finance_payments;
    
    CREATE POLICY "school isolation" ON public.finance_payments
        FOR ALL USING (school_id = ANY(my_school_ids()))
        WITH CHECK (school_id = ANY(my_school_ids()));
        
    RAISE NOTICE 'Updated finance_payments RLS to use my_school_ids() array.';
END $$;
