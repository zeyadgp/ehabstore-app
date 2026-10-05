ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS daily_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_start_points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_max_points integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS daily_after_max text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS daily_grace_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_referrer_points integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS referral_invitee_points integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS referral_commission_percent numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_points integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS unlock_min_order numeric NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS allow_partial_redeem boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_months integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS expiry_basis text NOT NULL DEFAULT 'earned',
  ADD COLUMN IF NOT EXISTS expiry_notify boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dev_commission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dev_commission_percent numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dev_commission_account text,
  ADD COLUMN IF NOT EXISTS refund_policy text NOT NULL DEFAULT 'both';

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_token text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_token_key ON public.orders (public_token) WHERE public_token IS NOT NULL;

UPDATE public.orders SET public_token = encode(gen_random_bytes(6), 'hex') WHERE public_token IS NULL;

CREATE OR REPLACE FUNCTION public.set_order_public_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(6), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_public_token ON public.orders;
CREATE TRIGGER orders_set_public_token BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_public_token();

CREATE OR REPLACE FUNCTION public.set_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_referral_code();

UPDATE public.profiles SET referral_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7)) WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS public.loyalty_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  day date NOT NULL,
  streak integer NOT NULL DEFAULT 1,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, day)
);

GRANT SELECT ON public.loyalty_checkins TO authenticated;
GRANT ALL ON public.loyalty_checkins TO service_role;
ALTER TABLE public.loyalty_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins admin read" ON public.loyalty_checkins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.developer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.loyalty_accounts(id) ON DELETE SET NULL,
  points_used integer NOT NULL DEFAULT 0,
  commission_points numeric NOT NULL DEFAULT 0,
  destination text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.developer_commissions TO authenticated;
GRANT ALL ON public.developer_commissions TO service_role;
ALTER TABLE public.developer_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev commissions admin read" ON public.developer_commissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));