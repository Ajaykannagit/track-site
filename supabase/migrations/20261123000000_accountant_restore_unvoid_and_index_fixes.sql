-- =========================================================================
-- MIGRATION: 20261123000000_accountant_restore_unvoid_and_index_fixes.sql
-- PURPOSE:
--   1. Convert unique constraints/indexes on soft-deletable tables to partial
--      unique indexes (WHERE deleted_at IS NULL) so soft-deleted rows never
--      block re-entry of the same employee/code/number.
--   2. Ensure wage_payments has is_void columns and get_account_balances()
--      respects is_void = false on wage_payments.
--   3. Allow Accountant (alongside MD) to call restore_record, restore_records
--      (Restore All / Bulk Restore), void_record, and unvoid_record, while
--      automatically sending detailed notifications to the MD whenever a
--      non-MD user performs any delete, bulk delete, restore, bulk restore,
--      void, or unvoid action.
-- =========================================================================

-- 1. Ensure wage_payments has void columns for consistency
ALTER TABLE public.wage_payments ADD COLUMN IF NOT EXISTS is_void boolean NOT NULL DEFAULT false;
ALTER TABLE public.wage_payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.wage_payments ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.wage_payments ADD COLUMN IF NOT EXISTS void_reason text;

-- 2. Partial Unique Indexes (WHERE deleted_at IS NULL) so soft-deleted records
--    never block re-entering the same code/number/date
DROP INDEX IF EXISTS public.uniq_attendance_emp;
CREATE UNIQUE INDEX uniq_attendance_emp
  ON public.attendance (employee_id, project_id, attendance_date)
  WHERE (employee_id IS NOT NULL AND deleted_at IS NULL);

DROP INDEX IF EXISTS public.uniq_attendance_con;
CREATE UNIQUE INDEX uniq_attendance_con
  ON public.attendance (contractor_id, project_id, attendance_date)
  WHERE (contractor_id IS NOT NULL AND deleted_at IS NULL);

DROP INDEX IF EXISTS public.uniq_cash_closing;
CREATE UNIQUE INDEX uniq_cash_closing
  ON public.cash_closing (closing_date, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), account_type)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
DROP INDEX IF EXISTS public.employees_employee_code_key;
CREATE UNIQUE INDEX employees_employee_code_key
  ON public.employees (employee_code)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.contractors DROP CONSTRAINT IF EXISTS contractors_contractor_code_key;
DROP INDEX IF EXISTS public.contractors_contractor_code_key;
CREATE UNIQUE INDEX contractors_contractor_code_key
  ON public.contractors (contractor_code)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_code_key;
DROP INDEX IF EXISTS public.projects_project_code_key;
CREATE UNIQUE INDEX projects_project_code_key
  ON public.projects (project_code)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_machine_code_key;
DROP INDEX IF EXISTS public.machines_machine_code_key;
CREATE UNIQUE INDEX machines_machine_code_key
  ON public.machines (machine_code)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_work_order_number_key;
DROP INDEX IF EXISTS public.work_orders_work_order_number_key;
CREATE UNIQUE INDEX work_orders_work_order_number_key
  ON public.work_orders (work_order_number)
  WHERE (deleted_at IS NULL);

ALTER TABLE public.measurement_books DROP CONSTRAINT IF EXISTS measurement_books_mb_number_key;
DROP INDEX IF EXISTS public.measurement_books_mb_number_key;
CREATE UNIQUE INDEX measurement_books_mb_number_key
  ON public.measurement_books (mb_number)
  WHERE (deleted_at IS NULL);

-- 3. Update get_account_balances() to include is_void = false on wage_payments
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE(
  account_type text,
  opening_balance numeric,
  total_inflows numeric,
  total_outflows numeric,
  current_balance numeric
)
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
    SELECT COALESCE(SUM(amount), 0) INTO v_exp
    FROM public.expenses
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(amount), 0) INTO v_sp
    FROM public.supplier_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL
      AND (group_payment_id IS NULL);

    SELECT COALESCE(SUM(amount), 0) INTO v_cp
    FROM public.contractor_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL
      AND (group_payment_id IS NULL);

    SELECT COALESCE(SUM(amount), 0) INTO v_subp
    FROM public.subcontractor_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    SELECT COALESCE(SUM(total_amount), 0) INTO v_gp
    FROM public.group_payments
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
$function$;

-- 4. Update restore_record: allow MD and Accounts, support all 30 tables,
--    and send notification to MD when restored by non-MD
CREATE OR REPLACE FUNCTION public.restore_record(
  p_table_name text,
  p_record_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_sql text;
  v_rec record;
  v_rec_title text := NULL;
  v_amount numeric(14,2) := NULL;
BEGIN
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) or Accountant can restore records.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments', 'labour_wage_payments',
    'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
    'work_orders', 'measurement_books', 'account_transfers', 'group_payments', 'md_investments', 'job_types'
  ) THEN
    RAISE EXCEPTION 'Table % does not support record restore.', p_table_name;
  END IF;

  -- Retrieve title & amount for audit and MD notification
  BEGIN
    EXECUTE format(
      $q$
      SELECT
        COALESCE(
          NULLIF(trim(to_jsonb(t)->>'po_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'bill_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'receipt_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'request_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'work_order_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'mb_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'payment_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'reference_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'name'), ''),
          NULLIF(trim(to_jsonb(t)->>'full_name'), ''),
          NULLIF(trim(to_jsonb(t)->>'description'), '')
        ) AS title,
        COALESCE(
          (to_jsonb(t)->>'total_amount')::numeric,
          (to_jsonb(t)->>'amount')::numeric,
          (to_jsonb(t)->>'contract_amount')::numeric,
          (to_jsonb(t)->>'net_amount')::numeric,
          (to_jsonb(t)->>'amount_paid')::numeric,
          (to_jsonb(t)->>'advance_paid')::numeric,
          (to_jsonb(t)->>'calculated_wage')::numeric,
          NULL
        ) AS amount
      FROM public.%I t WHERE id = %L
      $q$,
      p_table_name, p_record_id
    ) INTO v_rec;
    v_rec_title := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8));
    v_rec_amount := v_rec.amount;
  EXCEPTION WHEN OTHERS THEN
    v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
  END;

  v_sql := format('UPDATE public.%I SET deleted_at = NULL WHERE id = %L AND deleted_at IS NOT NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = NULL WHERE po_id = p_record_id;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = NULL WHERE receipt_id = p_record_id;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = NULL WHERE request_id = p_record_id;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details, reason
  ) VALUES (
    p_table_name, p_record_id, 'restore', p_table_name, v_user_id, now(),
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    jsonb_build_object(
      'restored', true,
      'record_title', v_rec_title,
      'amount', v_amount,
      'performer_email', v_user_email
    ),
    'Restored from Deleted Items'
  );

  -- Notify MD if restored by non-MD
  IF NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, reason,
      target_role, created_by, created_by_email, amount, details
    ) VALUES (
      'restore',
      format('Record Restored: %s (%s)', v_rec_title, initcap(replace(p_table_name, '_', ' '))),
      format('%s restored deleted %s "%s"%s.',
        COALESCE(v_user_email, 'Accountant'),
        initcap(replace(p_table_name, '_', ' ')),
        v_rec_title,
        CASE WHEN v_amount IS NOT NULL THEN format(' (₹%s)', v_amount) ELSE '' END
      ),
      p_table_name,
      p_record_id::text,
      'Restored from Deleted Items',
      'md',
      v_user_id,
      v_user_email,
      v_amount,
      jsonb_build_object(
        'table', p_table_name,
        'record_id', p_record_id::text,
        'title', v_rec_title,
        'amount', v_amount,
        'performer_email', v_user_email
      )
    );
  END IF;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_record(text, uuid) FROM anon, public;

-- 5. Add restore_records (Bulk / Restore All) with ONE consolidated notification to MD
CREATE OR REPLACE FUNCTION public.restore_records(
  p_items jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_item jsonb;
  v_tbl text;
  v_id uuid;
  v_count integer := 0;
  v_titles text[] := '{}';
  v_rec_title text;
  v_rec record;
BEGIN
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) or Accountant can restore records.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_tbl := v_item->>'table_name';
    v_id  := (v_item->>'record_id')::uuid;

    IF v_tbl IS NULL OR v_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_tbl NOT IN (
      'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
      'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
      'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
      'material_requests', 'material_request_items', 'project_quotations',
      'client_payments', 'payment_milestones', 'wage_payments', 'labour_wage_payments',
      'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
      'work_orders', 'measurement_books', 'account_transfers', 'group_payments', 'md_investments', 'job_types'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = %L AND deleted_at IS NOT NULL', v_tbl, v_id);

    IF v_tbl = 'purchase_orders' THEN
      UPDATE public.purchase_order_items SET deleted_at = NULL WHERE po_id = v_id;
    ELSIF v_tbl = 'material_receipts' THEN
      UPDATE public.material_receipt_items SET deleted_at = NULL WHERE receipt_id = v_id;
    ELSIF v_tbl = 'material_requests' THEN
      UPDATE public.material_request_items SET deleted_at = NULL WHERE request_id = v_id;
    END IF;

    BEGIN
      EXECUTE format(
        $q$
        SELECT COALESCE(
          NULLIF(trim(to_jsonb(t)->>'po_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'bill_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'receipt_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'request_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'work_order_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'mb_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'name'), ''),
          NULLIF(trim(to_jsonb(t)->>'full_name'), ''),
          NULLIF(trim(to_jsonb(t)->>'description'), '')
        ) AS title
        FROM public.%I t WHERE id = %L
        $q$,
        v_tbl, v_id
      ) INTO v_rec;
      v_rec_title := COALESCE(v_rec.title, upper(replace(v_tbl, '_', ' ')) || ' #' || substr(v_id::text, 1, 8));
    EXCEPTION WHEN OTHERS THEN
      v_rec_title := upper(replace(v_tbl, '_', ' ')) || ' #' || substr(v_id::text, 1, 8);
    END;

    v_titles := v_titles || ARRAY[v_rec_title];

    INSERT INTO public.audit_logs (
      table_name, record_id, action, module, performed_by, performed_at, user_role, details, reason
    ) VALUES (
      v_tbl, v_id, 'restore', v_tbl, v_user_id, now(),
      CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
      jsonb_build_object(
        'restored', true,
        'bulk_restore', true,
        'record_title', v_rec_title,
        'performer_email', v_user_email
      ),
      'Bulk restored from Deleted Items'
    );

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 AND NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, reason,
      target_role, created_by, created_by_email, details
    ) VALUES (
      'bulk_restore',
      format('Bulk Restore: %s deleted record(s) restored', v_count),
      format('%s restored %s deleted record(s): %s.',
        COALESCE(v_user_email, 'Accountant'),
        v_count,
        array_to_string(v_titles, ', ')
      ),
      'audit_logs',
      NULL,
      'Bulk restored from Deleted Items',
      'md',
      v_user_id,
      v_user_email,
      jsonb_build_object(
        'restored_count', v_count,
        'titles', v_titles,
        'performer_email', v_user_email
      )
    );
  END IF;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restore_records(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_records(jsonb) FROM anon, public;

-- 6. Update void_record & unvoid_record: allow MD and Accounts on both,
--    support all voidable tables, and notify MD whenever a non-MD user voids or unvoids
CREATE OR REPLACE FUNCTION public.void_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_grn_count integer := 0;
  v_pay_count integer := 0;
  v_sql text;
  v_rec record;
  v_rec_title text := NULL;
  v_amount numeric(14,2) := NULL;
BEGIN
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Accounts or MD can mark records as void.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A mandatory reason is required to void this record.';
  END IF;

  IF p_table_name NOT IN (
    'material_requests', 'purchase_orders', 'expenses', 'client_payments',
    'supplier_payments', 'contractor_bills', 'contractor_payments',
    'subcontractor_payments', 'account_transfers', 'cash_closing',
    'labour_wage_payments', 'wage_payments', 'md_investments', 'group_payments'
  ) THEN
    RAISE EXCEPTION 'Table % does not support voiding.', p_table_name;
  END IF;

  IF p_table_name = 'purchase_orders' THEN
    SELECT count(*) INTO v_grn_count
    FROM public.material_receipts
    WHERE po_id = p_record_id AND deleted_at IS NULL;

    IF v_grn_count > 0 THEN
      RAISE EXCEPTION 'Cannot void this Purchase Order because % Goods Receipt Note(s) are linked to it. Please void or delete the receipts first.', v_grn_count;
    END IF;

    SELECT count(*) INTO v_pay_count
    FROM public.supplier_payments
    WHERE po_id = p_record_id AND deleted_at IS NULL AND is_void = false;

    IF v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot void this Purchase Order because % active supplier payment(s) are linked to it. Please void the payments first.', v_pay_count;
    END IF;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  BEGIN
    EXECUTE format(
      $q$
      SELECT
        COALESCE(
          NULLIF(trim(to_jsonb(t)->>'po_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'bill_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'receipt_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'request_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'payment_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'reference_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'name'), ''),
          NULLIF(trim(to_jsonb(t)->>'category'), ''),
          NULLIF(trim(to_jsonb(t)->>'description'), '')
        ) AS title,
        COALESCE(
          (to_jsonb(t)->>'total_amount')::numeric,
          (to_jsonb(t)->>'amount')::numeric,
          (to_jsonb(t)->>'net_amount')::numeric,
          (to_jsonb(t)->>'amount_paid')::numeric,
          NULL
        ) AS amount
      FROM public.%I t WHERE id = %L
      $q$,
      p_table_name, p_record_id
    ) INTO v_rec;
    v_rec_title := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8));
    v_amount := v_rec.amount;
  EXCEPTION WHEN OTHERS THEN
    v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
  END;

  v_sql := format(
    'UPDATE public.%I SET is_void = true, voided_at = now(), voided_by = %L, void_reason = %L WHERE id = %L AND deleted_at IS NULL',
    p_table_name, v_user_id, trim(p_reason), p_record_id
  );
  EXECUTE v_sql;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, field_name,
    old_value, new_value, reason, user_role, performed_by, performed_at, details
  ) VALUES (
    p_table_name,
    p_record_id,
    'update',
    CASE
      WHEN p_table_name IN ('material_requests', 'purchase_orders') THEN 'materials'
      WHEN p_table_name IN ('expenses') THEN 'expenses'
      WHEN p_table_name IN ('contractor_bills', 'contractor_payments') THEN 'contractors'
      ELSE 'accounts'
    END,
    'is_void',
    'false',
    'true',
    p_reason,
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    v_user_id,
    now(),
    jsonb_build_object('void_action', true, 'reason', p_reason, 'record_title', v_rec_title, 'amount', v_amount)
  );

  IF NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, field_name, old_value, new_value, reason,
      target_role, created_by, created_by_email, amount, details
    ) VALUES (
      'void',
      format('Record Voided: %s (%s)', v_rec_title, initcap(replace(p_table_name, '_', ' '))),
      format('%s voided %s "%s"%s. Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        initcap(replace(p_table_name, '_', ' ')),
        v_rec_title,
        CASE WHEN v_amount IS NOT NULL THEN format(' (₹%s)', v_amount) ELSE '' END,
        trim(p_reason)
      ),
      p_table_name,
      p_record_id::text,
      'is_void',
      'Active',
      'VOID',
      trim(p_reason),
      'md',
      v_user_id,
      v_user_email,
      v_amount,
      jsonb_build_object(
        'table', p_table_name,
        'record_id', p_record_id::text,
        'title', v_rec_title,
        'amount', v_amount,
        'performer_email', v_user_email
      )
    );
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unvoid_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_sql text;
  v_rec record;
  v_rec_title text := NULL;
  v_amount numeric(14,2) := NULL;
BEGIN
  -- Both MD and Accountant can unvoid/restore voided records; MD is notified
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) or Accountant can restore voided records.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A mandatory reason is required to restore this voided record.';
  END IF;

  IF p_table_name NOT IN (
    'material_requests', 'purchase_orders', 'expenses', 'client_payments',
    'supplier_payments', 'contractor_bills', 'contractor_payments',
    'subcontractor_payments', 'account_transfers', 'cash_closing',
    'labour_wage_payments', 'wage_payments', 'md_investments', 'group_payments'
  ) THEN
    RAISE EXCEPTION 'Table % does not support unvoiding.', p_table_name;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  BEGIN
    EXECUTE format(
      $q$
      SELECT
        COALESCE(
          NULLIF(trim(to_jsonb(t)->>'po_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'bill_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'receipt_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'request_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'payment_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'reference_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'name'), ''),
          NULLIF(trim(to_jsonb(t)->>'category'), ''),
          NULLIF(trim(to_jsonb(t)->>'description'), '')
        ) AS title,
        COALESCE(
          (to_jsonb(t)->>'total_amount')::numeric,
          (to_jsonb(t)->>'amount')::numeric,
          (to_jsonb(t)->>'net_amount')::numeric,
          (to_jsonb(t)->>'amount_paid')::numeric,
          NULL
        ) AS amount
      FROM public.%I t WHERE id = %L
      $q$,
      p_table_name, p_record_id
    ) INTO v_rec;
    v_rec_title := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8));
    v_amount := v_rec.amount;
  EXCEPTION WHEN OTHERS THEN
    v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
  END;

  v_sql := format(
    'UPDATE public.%I SET is_void = false, voided_at = NULL, voided_by = NULL, void_reason = NULL WHERE id = %L AND deleted_at IS NULL',
    p_table_name, p_record_id
  );
  EXECUTE v_sql;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, field_name,
    old_value, new_value, reason, user_role, performed_by, performed_at, details
  ) VALUES (
    p_table_name,
    p_record_id,
    'update',
    CASE
      WHEN p_table_name IN ('material_requests', 'purchase_orders') THEN 'materials'
      WHEN p_table_name IN ('expenses') THEN 'expenses'
      WHEN p_table_name IN ('contractor_bills', 'contractor_payments') THEN 'contractors'
      ELSE 'accounts'
    END,
    'is_void',
    'true',
    'false',
    p_reason,
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    v_user_id,
    now(),
    jsonb_build_object('unvoid_action', true, 'reason', p_reason, 'record_title', v_rec_title, 'amount', v_amount)
  );

  IF NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, field_name, old_value, new_value, reason,
      target_role, created_by, created_by_email, amount, details
    ) VALUES (
      'unvoid',
      format('Void Restored: %s (%s)', v_rec_title, initcap(replace(p_table_name, '_', ' '))),
      format('%s restored voided %s "%s"%s. Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        initcap(replace(p_table_name, '_', ' ')),
        v_rec_title,
        CASE WHEN v_amount IS NOT NULL THEN format(' (₹%s)', v_amount) ELSE '' END,
        trim(p_reason)
      ),
      p_table_name,
      p_record_id::text,
      'is_void',
      'VOID',
      'Active',
      trim(p_reason),
      'md',
      v_user_id,
      v_user_email,
      v_amount,
      jsonb_build_object(
        'table', p_table_name,
        'record_id', p_record_id::text,
        'title', v_rec_title,
        'amount', v_amount,
        'performer_email', v_user_email
      )
    );
  END IF;

  RETURN true;
END;
$function$;
