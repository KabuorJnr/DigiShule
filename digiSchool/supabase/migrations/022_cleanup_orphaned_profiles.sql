-- 022_cleanup_orphaned_profiles.sql
-- Deletes any profiles whose matching auth.users row was deleted.
-- This prevents "duplicate key value violates unique constraint profiles_username_key"
-- when recreating a user with the same email after deleting them from Auth.

DELETE FROM public.profiles 
WHERE id NOT IN (SELECT id FROM auth.users);
