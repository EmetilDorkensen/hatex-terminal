-- Demann ranbousman kliyan → notifikasyon machann
CREATE TABLE IF NOT EXISTS public.hatex_refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN (
    'reservation', 'subscription', 'invoice', 'plugin', 'payment_request'
  )),
  source_id UUID NOT NULL,
  buyer_tx_id UUID,
  merchant_tx_id UUID,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  title TEXT NOT NULL DEFAULT 'Sèvis',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'cancelled')),
  merchant_notice_tx_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_hatex_refund_requests_merchant
  ON public.hatex_refund_requests (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hatex_refund_requests_buyer
  ON public.hatex_refund_requests (buyer_id, created_at DESC);

ALTER TABLE public.hatex_refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hatex_refund_requests_select_parties ON public.hatex_refund_requests;
CREATE POLICY hatex_refund_requests_select_parties ON public.hatex_refund_requests
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid() OR buyer_id = auth.uid());
