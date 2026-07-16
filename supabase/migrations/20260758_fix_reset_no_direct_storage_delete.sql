-- ============================================================================
-- Fix reset kont: PA efase dirèkteman storage.objects (Supabase entèdi sa).
-- Fichye yo efase via Storage API nan /api/admin/reset-account.
-- RPC a sèlman netwaye lyen nan DB + balans; KYC rete.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hatex_purge_agent_enterprise_docs(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize.');
  END IF;

  -- Pa DELETE sou storage.objects — itilize Storage API (service_role) nan API admin.
  RETURN json_build_object(
    'success', true,
    'files_deleted', 0,
    'via', 'storage_api_only',
    'user_id', p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_client_account(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('success', false, 'message', 'Aksè refize. Itilize API admin.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Kont pa jwenn.');
  END IF;

  -- Efase referans dokiman ajan (pa KYC)
  UPDATE public.agent_applications
  SET
    id_doc_url = NULL,
    address_doc_url = NULL,
    location_photo_url = NULL,
    patente_url = NULL,
    cif_url = NULL,
    selfie_with_id_url = NULL,
    criminal_record_url = NULL,
    bank_statement_url = NULL,
    lease_doc_url = NULL,
    status = 'rejected',
    rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('docs_purged', true, 'purged_at', now())
  WHERE user_id = p_user_id;

  -- Efase referans dokiman antrepriz
  UPDATE public.enterprise_applications
  SET
    patente_url = NULL,
    cif_url = NULL,
    business_registration_url = NULL,
    bank_statement_url = NULL,
    lease_doc_url = NULL,
    legal_rep_id_url = NULL,
    status = 'rejected',
    rejection_reason = COALESCE(rejection_reason, 'Admin reyinisyalize kont lan'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('docs_purged', true, 'purged_at', now())
  WHERE user_id = p_user_id;

  -- Balans zewo — KYC rete (kyc_front, kyc_selfie, kyc_status, kyc_fee_paid, elatriye)
  UPDATE public.profiles SET
    wallet_balance = 0,
    card_balance = 0,
    agent_balance = 0,
    agent_capacity = 0,
    agent_guarantee_paid = 0,
    agent_status = NULL,
    agent_tier = NULL,
    agent_code = NULL,
    upgrade_status = 'none',
    account_type = 'individual',
    business_name = NULL,
    enterprise_status = 'none',
    enterprise_fee_paid = 0
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, metadata)
  VALUES (
    p_user_id,
    'ADMIN_ACCOUNT_RESET',
    0,
    'success',
    'Admin reyinisyalize kont lan (balans 0, ajan/antrepriz + dokiman biznis efase via Storage API, KYC kenbe)',
    jsonb_build_object(
      'kept_kyc', true,
      'purged_agent_enterprise_docs', true,
      'storage_via', 'api'
    )
  );

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'kept_kyc', true,
    'docs_purged_via', 'storage_api'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hatex_purge_agent_enterprise_docs(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hatex_purge_agent_enterprise_docs(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_client_account(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
