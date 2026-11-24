CREATE FUNCTION public.hook_require_signup_address(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  address jsonb := event -> 'user' -> 'user_metadata';
BEGIN
  IF jsonb_typeof(address -> 'street_address') IS DISTINCT FROM 'string'
    OR (address ->> 'street_address') !~ '[^[:space:]]'
    OR jsonb_typeof(address -> 'city') IS DISTINCT FROM 'string'
    OR (address ->> 'city') !~ '[^[:space:]]'
    OR jsonb_typeof(address -> 'state') IS DISTINCT FROM 'string'
    OR upper(btrim(address ->> 'state')) !~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$'
    OR jsonb_typeof(address -> 'zip_code') IS DISTINCT FROM 'string'
    OR btrim(address ->> 'zip_code') !~ '^[0-9]{5}(-[0-9]{4})?$' THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Enter your street address, city, U.S. state, and valid ZIP code.'
    ));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.hook_require_signup_address(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_require_signup_address(jsonb) TO supabase_auth_admin;

CREATE FUNCTION beezio_private.save_registered_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  address jsonb := NEW.raw_user_meta_data;
BEGIN
  -- Service-created accounts can omit an address.
  IF public.hook_require_signup_address(jsonb_build_object('user', jsonb_build_object('user_metadata', address))) = '{}'::jsonb THEN
    UPDATE public.profiles
    SET street_address = btrim(address ->> 'street_address'),
        city = btrim(address ->> 'city'),
        state = upper(btrim(address ->> 'state')),
        zip_code = btrim(address ->> 'zip_code'),
        country = 'US',
        location = NULL
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION beezio_private.save_registered_address() FROM PUBLIC, anon, authenticated;

-- Same-event triggers run alphabetically. Save the address after profile creation.
CREATE TRIGGER on_auth_user_created_save_registered_address
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION beezio_private.save_registered_address();
