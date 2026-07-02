-- Function to lookup email for a given username during login
-- Needs SECURITY DEFINER to access auth.users table securely

CREATE OR REPLACE FUNCTION public.email_for_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE p.username = p_username
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

-- Grant execution to anon so unauthenticated users can look up their email to login
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO authenticated;
