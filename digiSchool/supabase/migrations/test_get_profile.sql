CREATE OR REPLACE FUNCTION get_profile_test(p_username TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT to_jsonb(p) INTO v_res FROM profiles p WHERE username = p_username;
  RETURN v_res;
END;
$$;
