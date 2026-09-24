-- Create trigger to automatically create EcoPoints profile when new user signs up
-- This ensures profiles are created safely server-side, preventing client-side profile spoofing

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a new profile for the newly created user
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        is_active,
        email_verified,
        total_points,
        member_since,
        preferences
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        TRUE,
        COALESCE((NOW() AT TIME ZONE 'utc')::date, CURRENT_DATE),
        0,
        CURRENT_DATE,
        '{}'::jsonb
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists (to allow recreation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that fires after insert on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();