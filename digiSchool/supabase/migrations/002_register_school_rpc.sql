-- =============================================================================
-- Create RPC to safely register a new school and link the caller's profile.
-- Run this in your Supabase SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION register_school(
    p_name TEXT,
    p_motto TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_county TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_website TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_school_id UUID;
    caller_uid UUID;
BEGIN
    -- 1. Get the authenticated user ID
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to register a school';
    END IF;

    -- 2. Insert the new school
    INSERT INTO schools (
        name, motto, type, county, address, phone, email, website, logo_url
    ) VALUES (
        p_name, p_motto, p_type, p_county, p_address, p_phone, p_email, p_website, p_logo_url
    ) RETURNING id INTO new_school_id;

    -- 3. Link the current user to this new school in their profile
    UPDATE profiles
    SET school_id = new_school_id
    WHERE id = caller_uid;

    -- 4. Initialize the school's app_config
    INSERT INTO app_config (
        school_id, 
        settings, 
        grade_boundaries, 
        fee_structure, 
        notif_toggles, 
        venues
    ) VALUES (
        new_school_id,
        '{}'::jsonb,
        '[{"min": 75, "grade": "A"}, {"min": 60, "grade": "B"}, {"min": 50, "grade": "C"}, {"min": 40, "grade": "D"}, {"min": 0, "grade": "E"}]'::jsonb,
        '[]'::jsonb,
        '{"sms": false, "exams": true, "fees": true, "email": true, "attendance": true}'::jsonb,
        '[]'::jsonb
    )
    ON CONFLICT (school_id) DO NOTHING;

    RETURN new_school_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION register_school TO authenticated;
