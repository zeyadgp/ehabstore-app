CREATE OR REPLACE FUNCTION public.set_order_public_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(extensions.gen_random_bytes(6), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;