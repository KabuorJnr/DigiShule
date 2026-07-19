-- Insert missing staff records for test users created via JS script

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'accountant') THEN
    ALTER TYPE app_role ADD VALUE 'accountant';
  END IF;
END $$;

-- Using DO block to safely bypass RLS as the postgres user
DO $$
BEGIN
    INSERT INTO public.staff (id, name, role, dept, status, school_id)
    SELECT id, raw_user_meta_data->>'name', raw_user_meta_data->>'role', 'Finance Office', 'Present', (SELECT id FROM public.schools LIMIT 1)
    FROM auth.users 
    WHERE email IN ('bursar@digischool.com', 'accountant@digischool.com')
    ON CONFLICT (id) DO UPDATE SET 
        role = EXCLUDED.role,
        name = EXCLUDED.name;

    INSERT INTO public.profiles (id, username, full_name, role, teacher_id, school_id)
    SELECT id, split_part(email, '@', 1), raw_user_meta_data->>'name', (raw_user_meta_data->>'role')::public.app_role, id, (SELECT id FROM public.schools LIMIT 1)
    FROM auth.users
    WHERE email IN ('bursar@digischool.com', 'accountant@digischool.com')
    ON CONFLICT (id, school_id, role) DO NOTHING;
END $$;
