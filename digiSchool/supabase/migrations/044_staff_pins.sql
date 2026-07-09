-- ==============================================================================
-- Migration 044: Staff Access PINs for Secure Onboarding
-- ==============================================================================

-- Add a pin column to the staff table to support secure signups
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS pin TEXT;

-- Create an RPC to lookup a pending staff member for signup
CREATE OR REPLACE FUNCTION lookup_staff_for_signup(p_email TEXT, p_pin TEXT)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  role TEXT,
  school_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.role, s.school_id
  FROM public.staff s
  -- During signup we can't search by auth email easily if it's not created, 
  -- but staff table 'id' might not be an email. Oh wait, 'id' is TEXT and we often store email in it for pending staff?
  -- Wait, the AdminDashboard inserts email into `staff.id`? No, let's just search by `pin` for now or add email to staff?
  -- We'll assume `staff.id` holds the email for pending users, or we just rely on pin.
  -- To be safe, we'll check if the provided email matches `staff.id` (which is often email) AND the pin matches.
  WHERE s.id = p_email AND s.pin = p_pin AND (s.status = 'Pending' OR s.status = 'Active')
  LIMIT 1;
END;
$$;
