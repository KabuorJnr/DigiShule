-- 040_fix_finance_payments_created_at.sql

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='created_at') THEN
    ALTER TABLE public.finance_payments ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='status') THEN
    ALTER TABLE public.finance_payments ADD COLUMN status TEXT DEFAULT 'Verified';
  END IF;
END $$;

-- Force Supabase PostgREST API to reload its schema cache
NOTIFY pgrst, 'reload schema';
