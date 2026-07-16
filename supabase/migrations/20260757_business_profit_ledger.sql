-- ============================================================================
-- Kont Pwofi Biznis sekirize: business_profit_account + business_profit_ledger
-- Tout kredi (frè) / debi (ranbousman, retrè) atomik, idempotent, service_role
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Kont + ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_profit_account (
  id TEXT PRIMARY KEY DEFAULT 'hatex_business_profit',
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.business_profit_account (id, balance)
VALUES ('hatex_business_profit', 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_profit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  entry_type TEXT NOT NULL,
  category TEXT,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  balance_after NUMERIC(14, 2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_profit_ledger_created
  ON public.business_profit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_profit_ledger_category
  ON public.business_profit_ledger(category, created_at DESC);

ALTER TABLE public.business_profit_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_profit_account_admin_select ON public.business_profit_account;
CREATE POLICY business_profit_account_admin_select ON public.business_profit_account
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email')
        AND s.status = 'active'
        AND s.role IN ('finance', 'super_admin')
    )
  );

DROP POLICY IF EXISTS business_profit_ledger_admin_select ON public.business_profit_ledger;
CREATE POLICY business_profit_ledger_admin_select ON public.business_profit_ledger
  FOR SELECT USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'adminhatexcard@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.staff_users s
      WHERE s.email = lower(auth.jwt() ->> 'email')
        AND s.status = 'active'
        AND s.role IN ('finance', 'super_admin')
    )
  );

REVOKE ALL ON public.business_profit_account FROM anon, authenticated;
REVOKE ALL ON public.business_profit_ledger FROM anon, authenticated;
GRANT SELECT ON public.business_profit_account TO authenticated;
GRANT SELECT ON public.business_profit_ledger TO authenticated;
GRANT ALL ON public.business_profit_account TO service_role;
GRANT ALL ON public.business_profit_ledger TO service_role;

-- ---------------------------------------------------------------------------
-- B. RPC santral: kredi / debi atomik
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hatex_business_profit_ledger_move(
  p_direction TEXT,
  p_amount NUMERIC,
  p_entry_type TEXT,
  p_category TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_bal NUMERIC;
  v_new_bal NUMERIC;
  v_amt NUMERIC;
  v_ledger_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
  -- Pèmèt lòt RPC SECURITY DEFINER rele l
    NULL;
  END IF;

  IF p_direction NOT IN ('credit', 'debit') THEN
    RETURN json_build_object('success', false, 'message', 'Direction pa valab.');
  END IF;
  v_amt := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amt <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Montan pa valab.');
  END IF;

  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    SELECT id, balance_after, amount, direction INTO v_existing
    FROM public.business_profit_ledger
    WHERE idempotency_key = trim(p_idempotency_key);
    IF FOUND THEN
      SELECT balance INTO v_bal FROM public.business_profit_account WHERE id = 'hatex_business_profit';
      RETURN json_build_object(
        'success', true,
        'duplicate', true,
        'ledger_id', v_existing.id,
        'balance_after', COALESCE(v_bal, v_existing.balance_after)
      );
    END IF;
  END IF;

  SELECT balance INTO v_bal
  FROM public.business_profit_account
  WHERE id = 'hatex_business_profit'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.business_profit_account (id, balance) VALUES ('hatex_business_profit', 0);
    v_bal := 0;
  END IF;

  IF p_direction = 'credit' THEN
    v_new_bal := COALESCE(v_bal, 0) + v_amt;
  ELSE
    IF COALESCE(v_bal, 0) < v_amt THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Kont pwofi biznis pa gen ase balans.',
        'balance', COALESCE(v_bal, 0),
        'requested', v_amt
      );
    END IF;
    v_new_bal := COALESCE(v_bal, 0) - v_amt;
  END IF;

  UPDATE public.business_profit_account
  SET balance = v_new_bal, updated_at = now()
  WHERE id = 'hatex_business_profit';

  INSERT INTO public.business_profit_ledger (
    direction, amount, entry_type, category,
    reference_type, reference_id, idempotency_key,
    balance_after, metadata
  )
  VALUES (
    p_direction, v_amt, p_entry_type, NULLIF(trim(p_category), ''),
    NULLIF(trim(p_reference_type), ''), NULLIF(trim(p_reference_id), ''),
    NULLIF(trim(p_idempotency_key), ''),
    v_new_bal, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_ledger_id;

  RETURN json_build_object(
    'success', true,
    'ledger_id', v_ledger_id,
    'balance_after', v_new_bal,
    'direction', p_direction,
    'amount', v_amt
  );
END;
$$;

-- Retrè pwofi: debi ledger + anrejistre istorik (atomik)
CREATE OR REPLACE FUNCTION public.hatex_business_profit_withdraw(
  p_amount NUMERIC,
  p_admin_email TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt NUMERIC;
  v_wid UUID;
  v_move JSON;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  v_amt := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amt <= 0 OR p_admin_email IS NULL OR length(trim(p_admin_email)) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Paramèt pa valab.');
  END IF;

  INSERT INTO public.business_profit_withdrawals (amount, note, admin_email)
  VALUES (v_amt, NULLIF(trim(p_note), ''), lower(trim(p_admin_email)))
  RETURNING id INTO v_wid;

  v_move := public.hatex_business_profit_ledger_move(
    'debit',
    v_amt,
    'withdrawal',
    'bank',
    'business_profit_withdrawal',
    v_wid::text,
    'withdrawal:' || v_wid::text,
    jsonb_build_object('admin_email', lower(trim(p_admin_email)), 'note', NULLIF(trim(p_note), ''))
  );

  IF NOT COALESCE((v_move->>'success')::boolean, false) THEN
    DELETE FROM public.business_profit_withdrawals WHERE id = v_wid;
    RETURN v_move;
  END IF;

  -- Debite Kès Global si gen (pa bloke retrè a)
  BEGIN
    PERFORM public.hatex_debit_kes_global(
      LEAST(v_amt, COALESCE((SELECT balance FROM public.platform_treasury WHERE id = 'kes_global'), 0))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'withdrawal_id', v_wid,
    'amount', v_amt,
    'balance_after', (v_move->>'balance_after')::numeric,
    'ledger_id', v_move->>'ledger_id'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_business_profit_ledger_move(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_business_profit_ledger_move(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.hatex_business_profit_withdraw(NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_business_profit_withdraw(NUMERIC, TEXT, TEXT)
  TO service_role;

-- ---------------------------------------------------------------------------
-- C. Triggers: frè antre otomatikman nan kont pwofi a
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_business_profit_tx_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt NUMERIC;
  v_cat TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'success' THEN
    RETURN NEW;
  END IF;

  v_amt := ABS(COALESCE(NEW.amount, 0));
  IF v_amt <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'FEE_REFUND' THEN
    PERFORM public.hatex_business_profit_ledger_move(
      'debit', v_amt, 'fee_refund',
      COALESCE(NEW.metadata->>'category', 'lòt'),
      'transaction', NEW.id::text,
      'tx_fee_refund:' || NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'description', NEW.description)
    );
    RETURN NEW;
  END IF;

  v_cat := CASE NEW.type
    WHEN 'FEE' THEN 'ajan'
    WHEN 'AGENT_WITHDRAW_FEE' THEN 'ajan'
    WHEN 'ENTERPRISE_FEE' THEN 'antrepriz'
    WHEN 'CARD_ACTIVATION' THEN 'kat'
    WHEN 'KYC_FEE' THEN 'kyc'
    WHEN 'API_FEE' THEN 'api'
    WHEN 'TRANSFER_FEE' THEN 'transfe'
    ELSE NULL
  END;

  IF v_cat IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.hatex_business_profit_ledger_move(
    'credit', v_amt, 'fee_collected', v_cat,
    'transaction', NEW.id::text,
    'tx_fee:' || NEW.id::text,
    jsonb_build_object('type', NEW.type, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_profit_tx_fee ON public.transactions;
CREATE TRIGGER trg_business_profit_tx_fee
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_business_profit_tx_fee();

CREATE OR REPLACE FUNCTION public.trg_business_profit_deposit_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved')
     AND COALESCE(NEW.fee, 0) > 0 THEN
    PERFORM public.hatex_business_profit_ledger_move(
      'credit', NEW.fee, 'fee_collected', 'depo',
      'deposit', NEW.id::text,
      'deposit_fee:' || NEW.id::text,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_profit_deposit_fee ON public.deposits;
CREATE TRIGGER trg_business_profit_deposit_fee
  AFTER INSERT OR UPDATE OF status, fee ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_business_profit_deposit_fee();

CREATE OR REPLACE FUNCTION public.trg_business_profit_withdrawal_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')
     AND COALESCE(NEW.fee, 0) > 0 THEN
    PERFORM public.hatex_business_profit_ledger_move(
      'credit', NEW.fee, 'fee_collected', 'retre',
      'withdrawal', NEW.id::text,
      'withdrawal_fee:' || NEW.id::text,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_profit_withdrawal_fee ON public.withdrawals;
CREATE TRIGGER trg_business_profit_withdrawal_fee
  AFTER INSERT OR UPDATE OF status, fee ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_business_profit_withdrawal_fee();

-- Transfè (tab transfers) si gen kolòn fee
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'fee'
  ) THEN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.trg_business_profit_transfer_fee()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    BEGIN
      IF COALESCE(NEW.fee, 0) > 0
         AND (NEW.status IS NULL OR NEW.status IN ('success', 'completed')) THEN
        IF TG_OP = 'INSERT' OR COALESCE(OLD.fee, 0) <> COALESCE(NEW.fee, 0) THEN
          PERFORM public.hatex_business_profit_ledger_move(
            'credit', NEW.fee, 'fee_collected', 'transfe',
            'transfer', NEW.id::text,
            'transfer_fee:' || NEW.id::text,
            '{}'::jsonb
          );
        END IF;
      END IF;
      RETURN NEW;
    END;
    $body$;

    DROP TRIGGER IF EXISTS trg_business_profit_transfer_fee ON public.transfers;
    CREATE TRIGGER trg_business_profit_transfer_fee
      AFTER INSERT OR UPDATE OF fee, status ON public.transfers
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_business_profit_transfer_fee();
  $fn$;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- D. Backfill inisyal: total nèt frè (pa debi ansyen retrè bank — yo rete istorik)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_dep NUMERIC := 0;
  v_wit NUMERIC := 0;
  v_tra NUMERIC := 0;
  v_tx NUMERIC := 0;
  v_ref NUMERIC := 0;
  v_net NUMERIC := 0;
  v_cur NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(fee), 0) INTO v_dep FROM public.deposits WHERE status = 'approved';
  SELECT COALESCE(SUM(fee), 0) INTO v_wit FROM public.withdrawals WHERE status = 'completed';

  -- Tab transfers ka pa gen kolòn fee (frè P2P deja nan transactions.TRANSFER_FEE)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'fee'
  ) THEN
    EXECUTE $q$
      SELECT COALESCE(SUM(fee), 0) FROM public.transfers
      WHERE fee > 0 AND (status IS NULL OR status IN ('success', 'completed'))
    $q$ INTO v_tra;
  ELSE
    v_tra := 0;
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_tx
  FROM public.transactions
  WHERE status = 'success'
    AND type IN ('FEE', 'AGENT_WITHDRAW_FEE', 'ENTERPRISE_FEE', 'CARD_ACTIVATION', 'KYC_FEE', 'API_FEE', 'TRANSFER_FEE');

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_ref
  FROM public.transactions
  WHERE status = 'success' AND type = 'FEE_REFUND';

  v_net := GREATEST(0, ROUND((v_dep + v_wit + v_tra + v_tx - v_ref)::numeric, 2));

  SELECT balance INTO v_cur FROM public.business_profit_account WHERE id = 'hatex_business_profit';
  IF v_cur IS NULL THEN v_cur := 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.business_profit_ledger WHERE idempotency_key = 'backfill:initial_net'
  ) AND v_net > 0 THEN
    PERFORM public.hatex_business_profit_ledger_move(
      'credit',
      v_net,
      'backfill',
      'total_net',
      'system',
      'backfill',
      'backfill:initial_net',
      jsonb_build_object(
        'depo', v_dep, 'retre', v_wit, 'transfe', v_tra,
        'tx_fees', v_tx, 'refunds', v_ref
      )
    );
  ELSIF v_cur = 0 AND v_net > 0 AND NOT EXISTS (
    SELECT 1 FROM public.business_profit_ledger WHERE idempotency_key = 'backfill:initial_net'
  ) THEN
    UPDATE public.business_profit_account SET balance = v_net, updated_at = now()
    WHERE id = 'hatex_business_profit';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
