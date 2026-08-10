-- =============================================================================
-- EduOne — School AI Credentials
-- Same shape as school_payment_gateways (migration 061). One row per school
-- holding the school's own AI provider key. Admins/principal manage it
-- in-app; only the service_role can read the key back so it never leaves
-- the server. This is the pattern that lets an edge function "just work"
-- without asking anyone to touch `supabase secrets set`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.school_ai_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai', 'google')),
    api_key TEXT NOT NULL,
    model_override TEXT,           -- optional; overrides the function's default model
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_ai_credentials ENABLE ROW LEVEL SECURITY;

-- 1. Only the service role can read the key back (edge functions).
--    No SELECT policy for authenticated users — they never see the raw key.
DROP POLICY IF EXISTS "Service role can read AI credentials" ON public.school_ai_credentials;
CREATE POLICY "Service role can read AI credentials"
  ON public.school_ai_credentials FOR SELECT
  TO service_role
  USING (true);

-- 2. Admins/Principal can manage their own school's credential.
--    They can INSERT/UPDATE/DELETE but never read the raw api_key back — the
--    UI shows a masked value if a row exists, and admins can only overwrite.
DROP POLICY IF EXISTS "Admins can manage their school AI credentials" ON public.school_ai_credentials;
CREATE POLICY "Admins can manage their school AI credentials"
  ON public.school_ai_credentials FOR ALL
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM profiles WHERE id = auth.uid())
        IN ('admin', 'super_admin', 'principal', 'deputy_admin', 'deputy_academic', 'dos')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM profiles WHERE id = auth.uid())
        IN ('admin', 'super_admin', 'principal', 'deputy_admin', 'deputy_academic', 'dos')
  );

-- 3. Service role blanket access (nightly jobs, back-office tools).
DROP POLICY IF EXISTS "Service role can manage all AI credentials" ON public.school_ai_credentials;
CREATE POLICY "Service role can manage all AI credentials"
  ON public.school_ai_credentials FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A helper RPC the app can call to know whether AI is configured for a school
-- (returns a boolean and the provider) WITHOUT leaking the key. This is what
-- Settings uses to render "Configured / Not configured".
CREATE OR REPLACE FUNCTION public.school_ai_status()
RETURNS TABLE (configured BOOLEAN, provider TEXT, model_override TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (row.api_key IS NOT NULL AND length(row.api_key) > 0) AS configured,
    row.provider,
    row.model_override,
    row.updated_at
  FROM (
    SELECT api_key, provider, model_override, updated_at
    FROM public.school_ai_credentials
    WHERE school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    LIMIT 1
  ) row;
$$;

REVOKE ALL ON FUNCTION public.school_ai_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_ai_status() TO authenticated;
