ALTER TABLE public.school_payment_gateways ADD COLUMN IF NOT EXISTS kcb_client_id TEXT;
ALTER TABLE public.school_payment_gateways ADD COLUMN IF NOT EXISTS kcb_client_secret TEXT;
ALTER TABLE public.school_payment_gateways ADD COLUMN IF NOT EXISTS kcb_biller_code TEXT;