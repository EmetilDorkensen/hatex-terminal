-- Pri abonnman ak kota jou — admin ka chanje nan paj Frè

INSERT INTO public.hatex_gateway_settings (key, label, value, unit, description) VALUES
  ('plan_capacity_price_htg', 'Pri plan Kapasite / mwa', 599, 'htg',
   'Sa machann peye sou MonCash pou 150 000 HTG/jou'),
  ('plan_premium_price_htg', 'Pri plan Premyòm / mwa', 999, 'htg',
   'Sa machann peye sou MonCash pou plan san limit jou'),
  ('daily_limit_free_htg', 'Kota jou — Gratis', 25000, 'htg',
   'Limit jou sou tout kòb resevwa pou plan Gratis'),
  ('daily_limit_capacity_htg', 'Kota jou — Kapasite', 150000, 'htg',
   'Limit jou pou plan Kapasite')
ON CONFLICT (key) DO NOTHING;
