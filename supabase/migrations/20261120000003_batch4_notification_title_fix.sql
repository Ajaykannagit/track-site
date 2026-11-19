-- Migration: 20261120000003_batch4_notification_title_fix.sql
-- B13: Fix soft_delete_records notification title so the MD sees meaningful names
-- instead of raw UUID fragments.
--
-- Root cause 1: v_rec IS NOT NULL is true even when all columns are NULL (a row was
--   returned but every COALESCE field was NULL), so v_rec.title can still be NULL.
-- Root cause 2: The fallback literal '#' || substr(v_id::text,1,8) is correct PL/pgSQL
--   quoting (''#'') but the COALESCE already handles it — the real issue is
--   COALESCE(v_rec.title, ...) inside the EXECUTE format is not surfacing the uuid short.
-- Fix: use explicit COALESCE on v_rec_title after the EXECUTE instead of inside it,
--   and add reference_number, invoice_number, request_number as extra title candidates.
--
-- This is a CREATE OR REPLACE of the ENTIRE function so it is idempotent.

CREATE OR REPLACE FUNCTION public.soft_delete_records(
  p_table_name text,
  p_record_ids uuid[],
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_id uuid;
  v_count integer := 0;
  v_total_amount numeric(14,2) := 0;
  v_titles text[] := '{}';
  v_rec_title text;
  v_rec_amount numeric;
  v_rec record;
  v_grn integer;
  v_pay integer;
  v_bills integer;
  v_dep_msg text;
BEGIN
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) or Accountant can delete records.';
  END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Step 1: Validate table whitelist
  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments', 'labour_wage_payments',
    'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
    'work_orders', 'measurement_books', 'account_transfers', 'group_payments', 'md_investments', 'job_types'
  ) THEN
    RAISE EXCEPTION 'Table % does not support soft delete.', p_table_name;
  END IF;

  -- Step 2: Run dependency checks FIRST (bubble any error immediately before deleting anything)
  FOREACH v_id IN ARRAY p_record_ids LOOP
    IF p_table_name = 'purchase_orders' THEN
      SELECT count(*) INTO v_grn FROM public.material_receipts WHERE po_id = v_id AND deleted_at IS NULL;
      SELECT count(*) INTO v_pay FROM public.supplier_payments WHERE po_id = v_id AND deleted_at IS NULL;
      IF v_grn > 0 OR v_pay > 0 THEN
        v_dep_msg := 'Cannot delete Purchase Order: ';
        IF v_grn > 0 THEN v_dep_msg := v_dep_msg || format('%s GRN(s) ', v_grn); END IF;
        IF v_pay > 0 THEN v_dep_msg := v_dep_msg || format('and %s payment(s) ', v_pay); END IF;
        RAISE EXCEPTION '%', v_dep_msg || 'are linked to it. Delete dependent records first.';
      END IF;
    ELSIF p_table_name = 'work_orders' THEN
      SELECT count(*) INTO v_bills FROM public.contractor_bills WHERE work_order_id = v_id AND deleted_at IS NULL;
      IF v_bills > 0 THEN
        RAISE EXCEPTION 'Cannot delete Work Order: % Contractor Bill(s) linked. Delete bills first.', v_bills;
      END IF;
    ELSIF p_table_name = 'contractor_bills' THEN
      SELECT count(*) INTO v_pay FROM public.contractor_payments WHERE bill_id = v_id AND deleted_at IS NULL;
      IF v_pay > 0 THEN
        RAISE EXCEPTION 'Cannot delete Contractor Bill: % Payment(s) linked. Delete payments first.', v_pay;
      END IF;
    END IF;
  END LOOP;

  -- Step 3: All dependency checks passed. Now delete and collect titles.
  FOREACH v_id IN ARRAY p_record_ids LOOP
    -- Soft-delete the record directly (no nested soft_delete_record call to avoid individual notifications)
    EXECUTE format(
      'UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL',
      p_table_name, v_id
    );

    -- Cascade child items
    IF p_table_name = 'purchase_orders' THEN
      UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = v_id AND deleted_at IS NULL;
    ELSIF p_table_name = 'material_receipts' THEN
      UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = v_id AND deleted_at IS NULL;
    ELSIF p_table_name = 'material_requests' THEN
      UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = v_id AND deleted_at IS NULL;
    ELSIF p_table_name = 'group_payments' THEN
      UPDATE public.group_payment_allocations SET deleted_at = now() WHERE group_payment_id = v_id AND deleted_at IS NULL;
    END IF;

    -- B13 FIX: Collect record title — COALESCE over all known identifier columns,
    -- then apply a second COALESCE after the EXECUTE so NULL rows always get the UUID short.
    v_rec_title := NULL;
    v_rec_amount := NULL;
    BEGIN
      EXECUTE format(
        $q$
        SELECT
          COALESCE(
            NULLIF(trim(to_jsonb(t)->>''po_number''),        ''''),
            NULLIF(trim(to_jsonb(t)->>''bill_number''),       ''''),
            NULLIF(trim(to_jsonb(t)->>''receipt_number''),    ''''),
            NULLIF(trim(to_jsonb(t)->>''request_number''),    ''''),
            NULLIF(trim(to_jsonb(t)->>''invoice_number''),    ''''),
            NULLIF(trim(to_jsonb(t)->>''reference_number''),  ''''),
            NULLIF(trim(to_jsonb(t)->>''name''),              ''''),
            NULLIF(trim(to_jsonb(t)->>''full_name''),         ''''),
            NULLIF(trim(to_jsonb(t)->>''description''),       '''')
          ) AS title,
          COALESCE(
            (to_jsonb(t)->>''total_amount'')::numeric,
            (to_jsonb(t)->>''amount'')::numeric,
            NULL
          ) AS amount
        FROM public.%I t WHERE id = %L
        $q$,
        p_table_name, v_id
      ) INTO v_rec;
      -- Apply outer COALESCE so we always get something readable (B13 fix)
      v_rec_title  := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(v_id::text, 1, 8));
      v_rec_amount := v_rec.amount;
    EXCEPTION WHEN OTHERS THEN
      v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(v_id::text, 1, 8);
    END;

    v_titles      := v_titles || ARRAY[v_rec_title];
    v_total_amount := v_total_amount + COALESCE(v_rec_amount, 0);

    -- Audit log per record
    INSERT INTO public.audit_logs (
      table_name, record_id, action, module, performed_by, performed_at, user_role, details
    ) VALUES (
      p_table_name, v_id, 'soft_delete', p_table_name, v_user_id, now(),
      CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
      jsonb_build_object('soft_deleted', true, 'reason', p_reason, 'bulk_delete', true,
                         'record_title', v_rec_title)
    );

    v_count := v_count + 1;
  END LOOP;

  -- Step 4: ONE summary notification to MD (only if deleted by non-MD and count > 0)
  IF v_count > 0 AND NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, reason,
      target_role, created_by, created_by_email, amount, details
    ) VALUES (
      'delete',
      -- B13 FIX: meaningful title — table label + count, no raw UUID
      format('Deleted %s %s', v_count, initcap(replace(p_table_name, '_', ' '))),
      format('%s deleted %s %s record(s): %s.%s Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        v_count,
        initcap(replace(p_table_name, '_', ' ')),
        array_to_string(v_titles, ', '),
        CASE WHEN v_total_amount > 0 THEN format(' Total amount: Rs.%s.', v_total_amount) ELSE '' END,
        COALESCE(trim(p_reason), 'No reason specified')
      ),
      p_table_name,
      p_record_ids[1]::text,
      p_reason,
      'md',
      v_user_id,
      v_user_email,
      CASE WHEN v_total_amount > 0 THEN v_total_amount ELSE NULL END,
      jsonb_build_object(
        'table', p_table_name,
        'deleted_count', v_count,
        'record_ids', p_record_ids::text[],
        'titles', v_titles
      )
    );
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_records(text, uuid[], text) TO authenticated;
