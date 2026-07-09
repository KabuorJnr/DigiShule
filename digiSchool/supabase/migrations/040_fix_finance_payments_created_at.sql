-- 040_fix_finance_payments_created_at.sql

DO $$ 
BEGIN
  -- Add all required columns for finance payments if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='student_id') THEN
    ALTER TABLE public.finance_payments ADD COLUMN student_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='adm') THEN
    ALTER TABLE public.finance_payments ADD COLUMN adm TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='invoice_id') THEN
    ALTER TABLE public.finance_payments ADD COLUMN invoice_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='amount') THEN
    ALTER TABLE public.finance_payments ADD COLUMN amount NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='method') THEN
    ALTER TABLE public.finance_payments ADD COLUMN method TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='ref') THEN
    ALTER TABLE public.finance_payments ADD COLUMN ref TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='date') THEN
    ALTER TABLE public.finance_payments ADD COLUMN date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='status') THEN
    ALTER TABLE public.finance_payments ADD COLUMN status TEXT DEFAULT 'Verified';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_payments' AND column_name='created_at') THEN
    ALTER TABLE public.finance_payments ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Force Supabase PostgREST API to reload its schema cache
NOTIFY pgrst, 'reload schema';
