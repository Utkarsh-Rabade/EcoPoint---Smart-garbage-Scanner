-- Fix handle_new_user() function to properly sets email_verified as boolean
-- Current error: inserting DATE into BOOLEAN column email_verified

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
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
        COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
        0,
        CURRENT_DATE,
        '{}'::jsonb
    );

    RETURN NEW;
END;
$function$;
