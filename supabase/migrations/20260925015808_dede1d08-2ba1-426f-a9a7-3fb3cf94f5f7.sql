CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  commission_percent numeric(5,2) NOT NULL DEFAULT 10.00,
  balance numeric(12,2) NOT NULL DEFAULT 0.00,
  total_earned numeric(12,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.affiliate_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  order_total numeric(12,2) NOT NULL DEFAULT 0.00,
  commission_percent numeric(5,2) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'YER',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'YER',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  payout_method text NOT NULL DEFAULT 'kuraimi',
  payout_details text,
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_influencers_user_id ON public.influencers(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_influencer_id ON public.affiliate_earnings(influencer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_order_id ON public.affiliate_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_influencer_id ON public.affiliate_withdrawals(influencer_id);

GRANT SELECT ON public.influencers, public.affiliate_earnings, public.affiliate_withdrawals TO authenticated;
GRANT ALL ON public.influencers, public.affiliate_earnings, public.affiliate_withdrawals TO service_role;

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influencers read own" ON public.influencers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "affiliate_earnings read own" ON public.affiliate_earnings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.influencers i WHERE i.id = affiliate_earnings.influencer_id AND i.user_id = auth.uid()));
CREATE POLICY "affiliate_withdrawals read own" ON public.affiliate_withdrawals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.influencers i WHERE i.id = affiliate_withdrawals.influencer_id AND i.user_id = auth.uid()));