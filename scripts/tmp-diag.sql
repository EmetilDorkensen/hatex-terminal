SELECT
  to_regclass('public.platform_limit_settings') AS limit_tbl,
  (SELECT count(*) FROM pg_proc p WHERE p.proname = 'hatex_resolve_limit') AS resolve_fn,
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'invoices' AND t.tgname = 'trg_invoice_daily_limit') AS trg,
  (SELECT count(*) FROM pg_indexes
     WHERE tablename = 'hatex_payments' AND indexname = 'idx_hp_merchant_order') AS hp_idx,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'hatex_products' AND column_name = 'share_token') AS prod_token,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'share_token') AS inv_token,
  (SELECT count(*) FROM public.hatex_products WHERE share_token IS NULL OR share_token = '') AS prod_no_token,
  (SELECT count(*) FROM public.invoices WHERE share_token IS NULL OR share_token = '') AS inv_no_token

