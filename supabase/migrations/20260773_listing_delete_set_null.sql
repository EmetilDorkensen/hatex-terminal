-- Pèmèt efase ofri (listing) menm lè gen istorik booking / abònman.
-- listing_id vin NULL sou ansyen dosye (receipt_snapshot kenbe detay yo).

ALTER TABLE public.reservation_bookings
  DROP CONSTRAINT IF EXISTS reservation_bookings_listing_id_fkey;

ALTER TABLE public.reservation_bookings
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.reservation_bookings
  ADD CONSTRAINT reservation_bookings_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.reservation_listings(id)
  ON DELETE SET NULL;

ALTER TABLE public.reservation_subscriptions
  DROP CONSTRAINT IF EXISTS reservation_subscriptions_listing_id_fkey;

ALTER TABLE public.reservation_subscriptions
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.reservation_subscriptions
  ADD CONSTRAINT reservation_subscriptions_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.reservation_listings(id)
  ON DELETE SET NULL;
