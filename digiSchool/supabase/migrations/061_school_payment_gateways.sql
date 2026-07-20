-- Secure Table for School Payment Gateways
CREATE TABLE IF NOT EXISTS public.school_payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE NOT NULL,
    mpesa_shortcode TEXT NOT NULL,
    mpesa_passkey TEXT NOT NULL,
    mpesa_consumer_key TEXT NOT NULL,
    mpesa_consumer_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Configuration
ALTER TABLE public.school_payment_gateways ENABLE ROW LEVEL SECURITY;

-- 1. NO ONE can select (read) these credentials directly except the service_role (Edge Functions)
-- We intentionally do not create a SELECT policy for authenticated users to protect the keys.

CREATE POLICY "Service role can read payment gateways" 
ON public.school_payment_gateways FOR SELECT 
TO service_role
USING (true);

-- 2. School Admins/Bursars can INSERT or UPDATE their own school's credentials
CREATE POLICY "Admins can manage their school gateways"
ON public.school_payment_gateways FOR ALL
USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'bursar', 'principal')
)
WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'bursar', 'principal')
);

-- 3. Service role can manage all
CREATE POLICY "Service role can manage all gateways"
ON public.school_payment_gateways FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create a secure View for the Frontend to check IF credentials exist (without exposing them)
CREATE OR REPLACE VIEW public.vw_school_payment_status AS
SELECT 
    school_id,
    mpesa_shortcode,
    CASE WHEN mpesa_consumer_key IS NOT NULL THEN true ELSE false END as is_configured,
    updated_at
FROM public.school_payment_gateways;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.vw_school_payment_status TO authenticated;
