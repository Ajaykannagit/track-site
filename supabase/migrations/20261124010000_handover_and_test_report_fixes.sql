-- =============================================================================
-- Migration: 20261124010000_handover_and_test_report_fixes.sql
-- Purpose: Fixes all database & lifecycle gaps identified in the 28-page
--          Full Project Handover (H1) and the 8-page Updated Test Report:
--          1. Reject duplicate reference_number on standalone supplier_payments
--             and contractor_payments (partial unique indexes on active rows).
--          2. Recompute PO status & billed_status from active GRNs using
--             ordered vs received quantities (so PO tax/freight does not leave
--             a 100%-received PO stuck at partially_received, and deleting/
--             restoring a GRN rolls back/re-advances PO status).
--          3. Fix get_account_balances() so group_payments with soft-deleted
--             child rows do not leave a stale Bank delta (sums active child
--             rows directly or active group allocations).
--          4. Soft-delete synthetic test fixtures (QA ZOHO Workflow 24Nov2026
--             1554 and CHECK 24Nov2026) and void historical QA wage rows
--             (8eb724bf-67fd-418f-ae60-9afd7424a785 and
--             a624e158-2536-411b-bf68-53c31f945d12).
-- =============================================================================

-- 1. Partial Unique Indexes on active standalone supplier_payments & contractor_payments reference_number
CREATE UNIQUE INDEX IF NOT EXISTS uniq_supplier_payments_ref_active
  ON public.supplier_payments (lower(trim(reference_number)))
  WHERE reference_number IS NOT NULL
    AND trim(reference_number) <> ''
    AND group_payment_id IS NULL
    AND is_void = false
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contractor_payments_ref_active
  ON public.contractor_payments (lower(trim(reference_number)))
  WHERE reference_number IS NOT NULL
    AND trim(reference_number) <> ''
    AND group_payment_id IS NULL
    AND is_void = false
    AND deleted_at IS NULL;

-- 2. Helper function & triggers to recompute PO status & billed_status from active GRNs
CREATE OR REPLACE FUNCTION public.recompute_po_receipt_status(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_po record;
  v_ordered_qty numeric(14,3) := 0;
  v_received_qty numeric(14,3) := 0;
  v_received_amt numeric(14,2) := 0;
  v_active_grn_count integer := 0;
  v_next_status text;
  v_next_billed text;
BEGIN
  IF p_po_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id, status, subtotal, total_amount
  INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id;

  IF NOT FOUND OR v_po.status::text = 'closed' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_ordered_qty
  FROM public.purchase_order_items
  WHERE po_id = p_po_id AND deleted_at IS NULL;

  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO v_active_grn_count, v_received_amt
  FROM public.material_receipts
  WHERE po_id = p_po_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(mri.received_quantity), 0)
  INTO v_received_qty
  FROM public.material_receipt_items mri
  JOIN public.material_receipts mr ON mr.id = mri.receipt_id
  WHERE mr.po_id = p_po_id
    AND mr.deleted_at IS NULL
    AND mri.deleted_at IS NULL;

  IF v_active_grn_count = 0 THEN
    -- Roll back status to approved/ordered when all GRNs are deleted/voided
    v_next_status := CASE
      WHEN v_po.status::text IN ('received', 'partially_received') THEN 'approved'
      ELSE v_po.status::text
    END;
    v_next_billed := 'yet_to_be_billed';
  ELSE
    v_next_billed := 'billed';
    IF v_ordered_qty > 0 THEN
      IF v_received_qty >= v_ordered_qty - 0.001 THEN
        v_next_status := 'received';
      ELSIF v_received_qty > 0 THEN
        v_next_status := 'partially_received';
      ELSE
        v_next_status := 'partially_received';
      END IF;
    ELSE
      -- Fallback to subtotal (pre-tax/transport) comparison if no line item quantities
      IF COALESCE(v_po.subtotal, v_po.total_amount, 0) > 0
         AND v_received_amt >= COALESCE(NULLIF(v_po.subtotal, 0), v_po.total_amount) - 0.01 THEN
        v_next_status := 'received';
      ELSE
        v_next_status := 'partially_received';
      END IF;
    END IF;
  END IF;

  UPDATE public.purchase_orders
  SET status = v_next_status::public.doc_status,
      billed_status = v_next_billed
  WHERE id = p_po_id
    AND (status::text IS DISTINCT FROM v_next_status OR billed_status IS DISTINCT FROM v_next_billed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_sync_po_on_grn_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_po_receipt_status(OLD.po_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.po_id IS DISTINCT FROM NEW.po_id THEN
      PERFORM public.recompute_po_receipt_status(OLD.po_id);
    END IF;
    PERFORM public.recompute_po_receipt_status(NEW.po_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_po_receipt_status(NEW.po_id);
    RETURN NEW;
  END IF;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_po_status_on_grn'
  ) THEN
    CREATE TRIGGER trg_sync_po_status_on_grn
      AFTER INSERT OR UPDATE OR DELETE ON public.material_receipts
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_sync_po_on_grn_change();
  END IF;
END $$;

-- 3. Update get_account_balances() so all supplier_payments & contractor_payments
--    (whether standalone or part of a group_payment) are summed directly from
--    their active, non-void, non-deleted child rows (preventing any orphan
--    group_payments header from causing a delta when child rows are soft-deleted).
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE(account_type text, opening_balance numeric, total_inflows numeric, total_outflows numeric, current_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_lwp numeric(14,2);
  v_wp numeric(14,2);
  v_trans_out numeric(14,2);
  v_adv numeric(14,2);
  v_inflows numeric(14,2);
  v_outflows numeric(14,2);
  v_curr numeric(14,2);
BEGIN
  FOR v_src IN SELECT unnest(ARRAY['bank', 'petty_cash']) LOOP
    SELECT COALESCE(a.opening_balance, 0) INTO v_open
    FROM public.account_opening_balances a
    WHERE a.account_type = v_src;
    v_open := COALESCE(v_open, 0);

    SELECT COALESCE(SUM(amount), 0) INTO v_client_rec
    FROM public.client_payments
    WHERE payment_source = v_src
      AND is_void = false
      AND deleted_at IS NULL
      AND (payment_category != 'reversal' OR payment_category IS NULL);

    SELECT COALESCE(SUM(amount), 0) INTO v_client_rev
    FROM public.client_payments
    WHERE payment_source = v_src
      AND is_void = false
      AND deleted_at IS NULL
      AND payment_category = 'reversal';

    SELECT COALESCE(SUM(amount), 0) INTO v_md_inv
    FROM public.md_investments
    WHERE payment_source = v_src
      AND is_void = false
      AND deleted_at IS NULL
      AND (transaction_type = 'investment' OR transaction_type IS NULL);

    SELECT COALESCE(SUM(amount), 0) INTO v_md_draw
    FROM public.md_investments
    WHERE payment_source = v_src
      AND is_void = false
      AND deleted_at IS NULL
      AND transaction_type = 'drawing';

    SELECT COALESCE(SUM(amount), 0) INTO v_trans_in
    FROM public.account_transfers
    WHERE to_account = v_src AND is_void = false AND deleted_at IS NULL;

    v_inflows := v_client_rec + v_md_inv + v_trans_in;

    SELECT COALESCE(SUM(amount), 0) INTO v_exp
    FROM public.expenses
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- Sum all active supplier_payments directly (including group_payment child rows whose parent is not void)
    SELECT COALESCE(SUM(sp.amount), 0) INTO v_sp
    FROM public.supplier_payments sp
    LEFT JOIN public.group_payments gp ON gp.id = sp.group_payment_id
    WHERE sp.payment_source = v_src
      AND sp.is_void = false
      AND sp.deleted_at IS NULL
      AND (sp.group_payment_id IS NULL OR (gp.is_void = false AND gp.deleted_at IS NULL));

    -- Sum all active contractor_payments directly (including group_payment child rows whose parent is not void)
    SELECT COALESCE(SUM(cp.amount), 0) INTO v_cp
    FROM public.contractor_payments cp
    LEFT JOIN public.group_payments gp ON gp.id = cp.group_payment_id
    WHERE cp.payment_source = v_src
      AND cp.is_void = false
      AND cp.deleted_at IS NULL
      AND (cp.group_payment_id IS NULL OR (gp.is_void = false AND gp.deleted_at IS NULL));

    SELECT COALESCE(SUM(amount), 0) INTO v_subp
    FROM public.subcontractor_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount_paid), 0) INTO v_lwp
    FROM public.labour_wage_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO v_wp
    FROM public.wage_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO v_trans_out
    FROM public.account_transfers
    WHERE from_account = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(advance_paid), 0) INTO v_adv
    FROM public.weekly_wage_adjustments
    WHERE payment_source = v_src AND advance_paid > 0 AND deleted_at IS NULL;

    v_outflows := v_exp + v_sp + v_cp + v_subp + v_lwp + v_wp + v_adv + v_trans_out + v_client_rev + v_md_draw;
    v_curr := v_open + v_inflows - v_outflows;

    account_type := v_src;
    opening_balance := v_open;
    total_inflows := v_inflows;
    total_outflows := v_outflows;
    current_balance := v_curr;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 4. Clean up QA & CHECK synthetic test fixtures per Section 21 & Page 4 of Test Report
UPDATE public.wage_payments
SET is_void = true,
    voided_at = now(),
    void_reason = 'QA financial cleanup handoff (Section 21: QA-V3-WAGE-1 & QA-V3-WAGE-2)'
WHERE id IN ('8eb724bf-67fd-418f-ae60-9afd7424a785', 'a624e158-2536-411b-bf68-53c31f945d12')
  AND is_void = false;

UPDATE public.group_payments
SET is_void = true,
    voided_at = now(),
    void_reason = 'QA financial cleanup handoff (Section 21: soft-deleted child contractor payments)'
WHERE id = '89ba3b89-76f9-477d-a09a-ff0b3ae3a40b'
  AND is_void = false;

-- Soft-delete CHECK 24Nov2026 synthetic records & QA ZOHO Workflow 24Nov2026 1554 synthetic planning project
UPDATE public.supplier_payments SET deleted_at = now(), is_void = true, void_reason = 'QA CHECK fixture cleanup' WHERE id = '3dcfd7f5-582a-4013-b84a-0e38a66d452f' AND deleted_at IS NULL;
UPDATE public.contractor_payments SET deleted_at = now(), is_void = true, void_reason = 'QA CHECK fixture cleanup' WHERE id = 'a8397ca1-9c59-4fbd-9847-05480e81730f' AND deleted_at IS NULL;
UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = 'cab93495-e592-42d9-aadd-78e99e22347f' AND deleted_at IS NULL;
UPDATE public.material_receipts SET deleted_at = now() WHERE id = 'cab93495-e592-42d9-aadd-78e99e22347f' AND deleted_at IS NULL;
UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = 'a7699dbf-f777-4ac8-98ca-ad2ec52e1643' AND deleted_at IS NULL;
UPDATE public.purchase_orders SET deleted_at = now(), is_void = true, void_reason = 'QA CHECK fixture cleanup' WHERE id = 'a7699dbf-f777-4ac8-98ca-ad2ec52e1643' AND deleted_at IS NULL;
UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = 'f685a44a-cfc8-45e7-8a0e-c586c6d6cbdf' AND deleted_at IS NULL;
UPDATE public.material_requests SET deleted_at = now(), is_void = true, void_reason = 'QA CHECK fixture cleanup' WHERE id = 'f685a44a-cfc8-45e7-8a0e-c586c6d6cbdf' AND deleted_at IS NULL;
UPDATE public.contractor_bills SET deleted_at = now(), is_void = true, void_reason = 'QA CHECK fixture cleanup' WHERE id = 'd471fd44-b9f0-4655-ad73-10a4081b6a69' AND deleted_at IS NULL;
UPDATE public.work_orders SET deleted_at = now() WHERE id = '4b455e12-c068-4cba-a4ad-bb65376feb9e' AND deleted_at IS NULL;
UPDATE public.suppliers SET deleted_at = now(), active = false WHERE id = '38856404-c959-4d1e-9204-9f89ddb39b3a' AND deleted_at IS NULL;
UPDATE public.contractors SET deleted_at = now(), active = false WHERE id = 'f75a153e-b795-4fe3-81ea-d975e1c88709' AND deleted_at IS NULL;
UPDATE public.projects SET deleted_at = now() WHERE id IN ('6774d16e-6e75-40ef-9df1-3746100ecc70', 'a1733e9f-ac4d-4ff6-8b9c-e54f82b4a9be') AND deleted_at IS NULL;
