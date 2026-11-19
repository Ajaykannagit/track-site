-- =============================================================================
-- MIGRATION: 20261120000000_batch1_critical_fixes_and_drawings.sql
-- =============================================================================
-- Fixes:
-- 1. Add transaction_type ('investment' | 'drawing') to public.md_investments (A3).
-- 2. Grant DELETE privilege on purchase_order_items, material_request_items,
--    and material_receipt_items to authenticated users with RLS enforcement (B2).
-- 3. Atomic functions:
--    - save_purchase_order_with_items (B2)
--    - save_material_request_with_items (B2)
--    - save_material_receipt_with_items (B2)
-- 4. Upgrade public.get_account_balances() to:
--    - Treat client receipt reversals (payment_category = 'reversal') as outflow/reduction (B3).
--    - Treat MD Drawings (transaction_type = 'drawing') as outflow (A3).
--    - Exclude contra account transfers from combined company revenue/expense volume (B12).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MD Investments & Drawings (A3)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'md_investments'
      AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE public.md_investments 
      ADD COLUMN transaction_type text NOT NULL DEFAULT 'investment'
      CHECK (transaction_type IN ('investment', 'drawing'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Grant DELETE on Item Tables for Authenticated Users (B2)
-- -----------------------------------------------------------------------------
GRANT DELETE ON public.purchase_order_items TO authenticated;
GRANT DELETE ON public.material_request_items TO authenticated;
GRANT DELETE ON public.material_receipt_items TO authenticated;

-- Ensure delete policies exist and are clean
DROP POLICY IF EXISTS "purchase_order_items delete policy" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items delete policy" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (public.is_finance_user());

DROP POLICY IF EXISTS "material_request_items delete policy" ON public.material_request_items;
CREATE POLICY "material_request_items delete policy" ON public.material_request_items
  FOR DELETE TO authenticated
  USING (public.is_finance_user());

DROP POLICY IF EXISTS "material_receipt_items delete policy" ON public.material_receipt_items;
CREATE POLICY "material_receipt_items delete policy" ON public.material_receipt_items
  FOR DELETE TO authenticated
  USING (public.is_finance_user());

-- -----------------------------------------------------------------------------
-- 3. Atomic Functions for Material Headers & Items (B2)
-- -----------------------------------------------------------------------------

-- 3.1 Save Purchase Order with Line Items
CREATE OR REPLACE FUNCTION public.save_purchase_order_with_items(
  p_po_id uuid,
  p_header jsonb,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid := p_po_id;
  v_item jsonb;
BEGIN
  IF NOT public.is_finance_user() THEN
    RAISE EXCEPTION 'Unauthorized: only finance users can save purchase orders';
  END IF;

  IF v_po_id IS NULL THEN
    INSERT INTO public.purchase_orders (
      po_number,
      project_id,
      supplier_id,
      request_id,
      po_date,
      status,
      subtotal,
      tax_percent,
      tax_amount,
      total_amount,
      terms,
      remarks,
      created_by
    ) VALUES (
      p_header->>'po_number',
      (p_header->>'project_id')::uuid,
      NULLIF(p_header->>'supplier_id', '')::uuid,
      NULLIF(p_header->>'request_id', '')::uuid,
      COALESCE((p_header->>'po_date')::date, CURRENT_DATE),
      COALESCE((p_header->>'status')::public.doc_status, 'draft'::public.doc_status),
      COALESCE((p_header->>'subtotal')::numeric, 0),
      COALESCE((p_header->>'tax_percent')::numeric, 0),
      COALESCE((p_header->>'tax_amount')::numeric, 0),
      COALESCE((p_header->>'total_amount')::numeric, 0),
      p_header->>'terms',
      p_header->>'remarks',
      auth.uid()
    )
    RETURNING id INTO v_po_id;
  ELSE
    UPDATE public.purchase_orders SET
      po_number = COALESCE(p_header->>'po_number', po_number),
      project_id = COALESCE((p_header->>'project_id')::uuid, project_id),
      supplier_id = NULLIF(p_header->>'supplier_id', '')::uuid,
      request_id = NULLIF(p_header->>'request_id', '')::uuid,
      po_date = COALESCE((p_header->>'po_date')::date, po_date),
      status = COALESCE((p_header->>'status')::public.doc_status, status),
      subtotal = COALESCE((p_header->>'subtotal')::numeric, subtotal),
      tax_percent = COALESCE((p_header->>'tax_percent')::numeric, tax_percent),
      tax_amount = COALESCE((p_header->>'tax_amount')::numeric, tax_amount),
      total_amount = COALESCE((p_header->>'total_amount')::numeric, total_amount),
      terms = p_header->>'terms',
      remarks = p_header->>'remarks',
      updated_by = auth.uid(),
      updated_at = now()
    WHERE id = v_po_id;

    -- Cleanly delete old items before replacing
    DELETE FROM public.purchase_order_items WHERE po_id = v_po_id;
  END IF;

  -- Insert new line items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.purchase_order_items (
        po_id,
        material,
        specification,
        unit,
        quantity,
        rate,
        amount,
        gst_percent
      ) VALUES (
        v_po_id,
        v_item->>'material',
        v_item->>'specification',
        v_item->>'unit',
        COALESCE((v_item->>'quantity')::numeric, 0),
        COALESCE((v_item->>'rate')::numeric, 0),
        COALESCE((v_item->>'amount')::numeric, 0),
        COALESCE((v_item->>'gst_percent')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_purchase_order_with_items(uuid, jsonb, jsonb) TO authenticated;

-- 3.2 Save Material Request (Indent) with Line Items
CREATE OR REPLACE FUNCTION public.save_material_request_with_items(
  p_request_id uuid,
  p_header jsonb,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid := p_request_id;
  v_item jsonb;
BEGIN
  IF NOT public.is_finance_user() THEN
    RAISE EXCEPTION 'Unauthorized: only finance users can save material requests';
  END IF;

  IF v_request_id IS NULL THEN
    INSERT INTO public.material_requests (
      request_number,
      project_id,
      request_date,
      required_date,
      status,
      remarks,
      total_amount,
      created_by
    ) VALUES (
      p_header->>'request_number',
      (p_header->>'project_id')::uuid,
      COALESCE((p_header->>'request_date')::date, CURRENT_DATE),
      (p_header->>'required_date')::date,
      COALESCE((p_header->>'status')::public.doc_status, 'draft'::public.doc_status),
      p_header->>'remarks',
      COALESCE((p_header->>'total_amount')::numeric, 0),
      auth.uid()
    )
    RETURNING id INTO v_request_id;
  ELSE
    UPDATE public.material_requests SET
      request_number = COALESCE(p_header->>'request_number', request_number),
      project_id = COALESCE((p_header->>'project_id')::uuid, project_id),
      request_date = COALESCE((p_header->>'request_date')::date, request_date),
      required_date = (p_header->>'required_date')::date,
      status = COALESCE((p_header->>'status')::public.doc_status, status),
      remarks = p_header->>'remarks',
      total_amount = COALESCE((p_header->>'total_amount')::numeric, total_amount),
      updated_by = auth.uid(),
      updated_at = now()
    WHERE id = v_request_id;

    DELETE FROM public.material_request_items WHERE request_id = v_request_id;
  END IF;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.material_request_items (
        request_id,
        material,
        specification,
        unit,
        quantity,
        rate,
        amount
      ) VALUES (
        v_request_id,
        v_item->>'material',
        v_item->>'specification',
        v_item->>'unit',
        COALESCE((v_item->>'quantity')::numeric, 0),
        COALESCE((v_item->>'rate')::numeric, 0),
        COALESCE((v_item->>'amount')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_material_request_with_items(uuid, jsonb, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Upgraded get_account_balances() (A3, B3, B12)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE(
  account_type text,
  opening_balance numeric(14,2),
  total_inflows numeric(14,2),
  total_outflows numeric(14,2),
  current_balance numeric(14,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src text;
  v_open numeric(14,2);
  v_client_rec numeric(14,2);
  v_client_rev numeric(14,2);
  v_md_inv numeric(14,2);
  v_md_draw numeric(14,2);
  v_trans_in numeric(14,2);
  v_exp numeric(14,2);
  v_sp numeric(14,2);
  v_cp numeric(14,2);
  v_subp numeric(14,2);
  v_gp numeric(14,2);
  v_lwp numeric(14,2);
  v_wp numeric(14,2);
  v_trans_out numeric(14,2);
  v_adv numeric(14,2);
  v_inflows numeric(14,2);
  v_outflows numeric(14,2);
  v_curr numeric(14,2);
BEGIN
  FOR v_src IN SELECT unnest(ARRAY['bank', 'petty_cash']) LOOP
    -- 1. Opening Balance
    SELECT COALESCE(a.opening_balance, 0) INTO v_open
    FROM public.account_opening_balances a
    WHERE a.account_type = v_src;
    v_open := COALESCE(v_open, 0);

    -- 2. Client Receipts (Inflow, excluding reversals)
    SELECT COALESCE(SUM(amount), 0) INTO v_client_rec
    FROM public.client_payments
    WHERE payment_source = v_src 
      AND is_void = false 
      AND deleted_at IS NULL
      AND (payment_category != 'reversal' OR payment_category IS NULL);

    -- 2b. Client Reversals / Refunds (Outflow reduction)
    SELECT COALESCE(SUM(amount), 0) INTO v_client_rev
    FROM public.client_payments
    WHERE payment_source = v_src 
      AND is_void = false 
      AND deleted_at IS NULL
      AND payment_category = 'reversal';

    -- 3. MD Investments (Inflow)
    SELECT COALESCE(SUM(amount), 0) INTO v_md_inv
    FROM public.md_investments
    WHERE payment_source = v_src 
      AND is_void = false 
      AND deleted_at IS NULL
      AND (transaction_type = 'investment' OR transaction_type IS NULL);

    -- 3b. MD Drawings (Outflow reduction)
    SELECT COALESCE(SUM(amount), 0) INTO v_md_draw
    FROM public.md_investments
    WHERE payment_source = v_src 
      AND is_void = false 
      AND deleted_at IS NULL
      AND transaction_type = 'drawing';

    -- 4. Transfers In
    SELECT COALESCE(SUM(amount), 0) INTO v_trans_in
    FROM public.account_transfers
    WHERE to_account = v_src AND is_void = false AND deleted_at IS NULL;

    v_inflows := v_client_rec + v_md_inv + v_trans_in;

    -- 5. Outflows
    -- Expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_exp
    FROM public.expenses
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- Supplier payments (exclude if part of group payment)
    SELECT COALESCE(SUM(amount), 0) INTO v_sp
    FROM public.supplier_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL
      AND (group_payment_id IS NULL);

    -- Contractor payments (exclude if part of group payment)
    SELECT COALESCE(SUM(amount), 0) INTO v_cp
    FROM public.contractor_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL
      AND (group_payment_id IS NULL);

    -- Subcontractor payments
    SELECT COALESCE(SUM(amount), 0) INTO v_subp
    FROM public.subcontractor_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- Group payments headers
    SELECT COALESCE(SUM(total_amount), 0) INTO v_gp
    FROM public.group_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- Labour wage payments
    SELECT COALESCE(SUM(amount_paid), 0) INTO v_lwp
    FROM public.labour_wage_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- Legacy wage payments
    SELECT COALESCE(SUM(amount), 0) INTO v_wp
    FROM public.wage_payments
    WHERE payment_source = v_src AND deleted_at IS NULL;

    -- Transfers Out
    SELECT COALESCE(SUM(amount), 0) INTO v_trans_out
    FROM public.account_transfers
    WHERE from_account = v_src AND is_void = false AND deleted_at IS NULL;

    -- Worker advances
    SELECT COALESCE(SUM(advance_paid), 0) INTO v_adv
    FROM public.weekly_wage_adjustments
    WHERE payment_source = v_src AND advance_paid > 0 AND deleted_at IS NULL;

    -- Total outflows include client reversals and MD drawings
    v_outflows := v_exp + v_sp + v_cp + v_subp + v_gp + v_lwp + v_wp + v_adv + v_trans_out + v_client_rev + v_md_draw;
    v_curr := v_open + v_inflows - v_outflows;

    account_type := v_src;
    opening_balance := v_open;
    total_inflows := v_inflows;
    total_outflows := v_outflows;
    current_balance := v_curr;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balances() TO authenticated;
