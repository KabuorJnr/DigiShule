-- Insert missing staff records for test users created via JS script
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
    SELECT id, split_part(email, '@', 1), raw_user_meta_data->>'name', raw_user_meta_data->>'role', id, (SELECT id FROM public.schools LIMIT 1)
    FROM auth.users
    WHERE email IN ('bursar@digischool.com', 'accountant@digischool.com')
    ON CONFLICT (id) DO NOTHING;
END $$;
