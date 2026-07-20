-- Create mpesa_transactions table
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    checkout_request_id TEXT NOT NULL UNIQUE,
    merchant_request_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    phone_number TEXT NOT NULL,
    invoice_id TEXT REFERENCES public.invoices(id) ON DELETE SET NULL,
    student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Completed, Failed, Cancelled
    mpesa_receipt_number TEXT,
    result_desc TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_invoice ON public.mpesa_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_school ON public.mpesa_transactions(school_id);

-- RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions for their school" 
ON public.mpesa_transactions FOR SELECT 
USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Anyone can insert mpesa transaction"
ON public.mpesa_transactions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can manage transactions"
ON public.mpesa_transactions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
