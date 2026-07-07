-- 028_auto_confirm_users.sql
-- Automatically confirms emails for newly created users so they can log in immediately
-- without needing to click an email verification link (which causes "Invalid login credentials").

CREATE OR REPLACE FUNCTION public.auto_confirm_users()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.auto_confirm_users();
