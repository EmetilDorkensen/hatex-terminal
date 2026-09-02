-- 20260903_payment_products.sql
-- Pwodwi + lyen peman (KREYE YON PWODWI) — checkout piblik /p/[slug]
-- Kliyan peye ak MonCash; machann lan resevwa sou kont li te chwazi a.

BEGIN;

-- ============================================================
-- 1. Tab pwodwi machann lan
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hatex_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT,
  price_htg NUMERIC(12, 2) NOT NULL CHECK (price_htg >= 10),
  image_url TEXT,
  payout_account_id UUID REFERENCES public.hatex_bank_accounts(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sales_count INTEGER NOT NULL DEFAULT 0,
  total_received_htg NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hatex_products_slug_fmt CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT hatex_products_owner_slug UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hatex_products_owner
  ON public.hatex_products (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hatex_products_slug_active
  ON public.hatex_products (slug)
  WHERE active = TRUE;

ALTER TABLE public.hatex_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hp_owner_select ON public.hatex_products;
CREATE POLICY hp_owner_select ON public.hatex_products
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS hp_owner_insert ON public.hatex_products;
CREATE POLICY hp_owner_insert ON public.hatex_products
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS hp_owner_update ON public.hatex_products;
CREATE POLICY hp_owner_update ON public.hatex_products
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS hp_owner_delete ON public.hatex_products;
CREATE POLICY hp_owner_delete ON public.hatex_products
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- 2. Peman pwodwi (purpose 'product') nan hatex_payments
-- ============================================================
-- ATANSYON: lòt migrasyon yo + aplikasyon an sèvi ak 'plan_fee' (pa 'plan').
-- Nou ajoute sèlman 'product' nan lis ki te deja egziste a — sinon ADD CONSTRAINT
-- la ta refize tout liy ki gen purpose = 'plan_fee' (ERROR 23514) epi rejete
-- tout fichye migrasyon an (BEGIN/COMMIT).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hatex_payments_purpose_check'
  ) THEN
    ALTER TABLE public.hatex_payments DROP CONSTRAINT hatex_payments_purpose_check;
  END IF;
END $$;

ALTER TABLE public.hatex_payments
  ADD CONSTRAINT hatex_payments_purpose_check
  CHECK (purpose IN ('merchant', 'kyc_fee', 'crypto_buy', 'invoice', 'plan_fee', 'product'));


-- ============================================================
-- 3. Bucket storage pou foto pwodwi
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS product_images_insert ON storage.objects;
CREATE POLICY product_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS product_images_select_public ON storage.objects;
CREATE POLICY product_images_select_public ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_update ON storage.objects;
CREATE POLICY product_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS product_images_delete ON storage.objects;
CREATE POLICY product_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;

