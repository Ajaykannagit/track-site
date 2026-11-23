-- =====================================================================
-- Migration: 20261123010000_qa_final_report_fixes.sql
-- Purpose:
--   1. Add deleted_at column to public.job_types (Fix 4.1: Job Type deletion failed).
--   2. Update SELECT RLS policies on job_types, contractors, suppliers, machines,
--      employees, group_payments, labour_wage_payments, project_quotations, and
--      weekly_wage_adjustments to enforce `deleted_at IS NULL` so soft-deleted
--      rows immediately disappear from UI lists without requiring a second click
--      (Fix 4.8a: duplicate delete notifications on first attempt).
--   3. Fix soft_delete_record and soft_delete_records:
--      - Exclude voided records (`COALESCE(is_void, false) = false`) in dependency
--        guards for projects, purchase_orders, work_orders, and contractor_bills
--        (Fix 4.3 & 4.6: voided receipts/payments blocking project/PO deletion).
--      - Fix record title lookup in soft_delete_record so notifications always
--        display the actual record name/number (e.g. "QA-23NOV-MACHINE", "MR-03455008")
--        instead of "Record" or "material_requests #..." (Fix 4.8b).
--      - Cascade soft-delete to child items in soft_delete_record just like
--        soft_delete_records.
--   4. Update trg_track_row_edits to skip generating a redundant "Edit in <table>"
--        notification when the update is a soft-delete, restore, void, or unvoid
--        (since those RPCs already emit their own dedicated notifications).
-- =====================================================================

-- 1. Add deleted_at to job_types
ALTER TABLE public.job_types
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Update SELECT RLS policies to filter out soft-deleted rows (deleted_at IS NULL)
ALTER POLICY "job_types_select_policy" ON public.job_types
  USING (deleted_at IS NULL);

ALTER POLICY "contractors read policy" ON public.contractors
  USING ((deleted_at IS NULL) AND public.is_operations_user());

ALTER POLICY "suppliers read policy" ON public.suppliers
  USING ((deleted_at IS NULL) AND public.is_operations_user());

ALTER POLICY "read all" ON public.machines
  USING (deleted_at IS NULL);

ALTER POLICY "employees read policy" ON public.employees
  USING ((deleted_at IS NULL) AND public.is_operations_user());

ALTER POLICY "group_payments_select_policy" ON public.group_payments
  USING (deleted_at IS NULL);

ALTER POLICY "lwp_select_policy" ON public.labour_wage_payments
  USING (deleted_at IS NULL);

ALTER POLICY "project_quotations read policy" ON public.project_quotations
  USING ((deleted_at IS NULL) AND public.is_finance_user());

ALTER POLICY "weekly_wage_adjustments select policy" ON public.weekly_wage_adjustments
  USING ((deleted_at IS NULL) AND public.is_finance_user());

-- 3. Update trg_track_row_edits so soft-delete / restore / void / unvoid do not emit duplicate "Edit in ..." notifications
CREATE OR REPLACE FUNCTION public.trg_track_row_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_md boolean := false;
  v_has_real_changes boolean := false;
BEGIN
  -- If deleted_at or is_void changed, this is a soft-delete/restore/void/unvoid handled by its dedicated RPC
  IF (to_jsonb(NEW)->>'deleted_at') IS DISTINCT FROM (to_jsonb(OLD)->>'deleted_at') THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)->>'is_void') IS DISTINCT FROM (to_jsonb(OLD)->>'is_void') THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'updated_at' - 'last_edited_at' - 'last_edited_by') IS DISTINCT FROM
     (to_jsonb(OLD) - 'updated_at' - 'last_edited_at' - 'last_edited_by') THEN
    v_has_real_changes := true;
  END IF;

  IF NOT v_has_real_changes THEN
    RETURN NEW;
  END IF;

  NEW.last_edited_at = now();
  NEW.last_edited_by = v_user_id;

  SELECT public.is_md() INTO v_is_md;

  IF NOT COALESCE(v_is_md, false) THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id,
      target_role, created_by, created_by_email, details
    ) VALUES (
      'edit',
      'Edit in ' || replace(TG_TABLE_NAME, '_', ' '),
      'Record modified in ' || TG_TABLE_NAME || ' by ' || COALESCE(v_user_email, 'user'),
      TG_TABLE_NAME,
      NEW.id::text,
      'md',
      v_user_id,
      v_user_email,
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Update soft_delete_record (3-arg version) with void-aware dependency checks, proper record title lookup, and child cascades
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS boolean
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
  v_rec_title text;
  v_amount numeric(14,2) := NULL;
  v_project_id text := NULL;
  v_grn_count integer := 0;
  v_pay_count integer := 0;
  v_bill_count integer := 0;
  v_wo_count integer := 0;
  v_dep_msg text := '';
  v_already_deleted timestamptz;
BEGIN
  -- 1. Authorization: MD or Accounts
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) or Accountant can delete records.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 2. Whitelist validation
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

  -- Check if already soft-deleted (idempotency guard so duplicate notifications are never sent)
  EXECUTE format('SELECT deleted_at FROM public.%I WHERE id = %L', p_table_name, p_record_id)
    INTO v_already_deleted;
  IF v_already_deleted IS NOT NULL THEN
    RETURN true;
  END IF;

  -- 3. Strict Dependency Checks (excluding soft-deleted AND voided records)
  IF p_table_name = 'purchase_orders' THEN
    SELECT count(*) INTO v_grn_count
    FROM public.material_receipts
    WHERE po_id = p_record_id AND deleted_at IS NULL;

    SELECT count(*) INTO v_pay_count
    FROM public.supplier_payments
    WHERE po_id = p_record_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;

    IF v_grn_count > 0 OR v_pay_count > 0 THEN
      v_dep_msg := 'Cannot delete Purchase Order: ';
      IF v_grn_count > 0 THEN v_dep_msg := v_dep_msg || format('%s Goods Receipt(s) ', v_grn_count); END IF;
      IF v_pay_count > 0 THEN v_dep_msg := v_dep_msg || format('and %s active Supplier Payment(s) ', v_pay_count); END IF;
      v_dep_msg := v_dep_msg || 'are linked to it. Delete or void dependent records first.';
      RAISE EXCEPTION '%', v_dep_msg;
    END IF;

  ELSIF p_table_name = 'work_orders' THEN
    SELECT count(*) INTO v_bill_count
    FROM public.contractor_bills
    WHERE work_order_id = p_record_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;

    IF v_bill_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Work Order: % active Contractor Bill(s) are linked to it. Delete or void dependent bills first.', v_bill_count;
    END IF;

  ELSIF p_table_name = 'contractor_bills' THEN
    SELECT count(*) INTO v_pay_count
    FROM public.contractor_payments
    WHERE bill_id = p_record_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;

    IF v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Contractor Bill: % active Payment(s) are linked to it. Delete or void payments first.', v_pay_count;
    END IF;

  ELSIF p_table_name = 'projects' THEN
    SELECT count(*) INTO v_wo_count
    FROM public.work_orders
    WHERE project_id = p_record_id AND deleted_at IS NULL;

    SELECT count(*) INTO v_grn_count
    FROM public.purchase_orders
    WHERE project_id = p_record_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;

    SELECT count(*) INTO v_pay_count
    FROM public.client_payments
    WHERE project_id = p_record_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;

    IF v_wo_count > 0 OR v_grn_count > 0 OR v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Project: Has % active Work Order(s), % active PO(s), and % active Client Payment(s). Delete or void project records first.', v_wo_count, v_grn_count, v_pay_count;
    END IF;
  END IF;

  -- 4. Retrieve readable title and amount for audit log & notification
  v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
  BEGIN
    EXECUTE format(
      $q$
      SELECT
        COALESCE(
          NULLIF(trim(to_jsonb(t)->>'po_number'),         ''),
          NULLIF(trim(to_jsonb(t)->>'request_number'),    ''),
          NULLIF(trim(to_jsonb(t)->>'receipt_number'),    ''),
          NULLIF(trim(to_jsonb(t)->>'bill_number'),       ''),
          NULLIF(trim(to_jsonb(t)->>'work_order_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'mb_number'),         ''),
          NULLIF(trim(to_jsonb(t)->>'name'),              ''),
          NULLIF(trim(to_jsonb(t)->>'full_name'),         ''),
          NULLIF(trim(to_jsonb(t)->>'project_code'),      ''),
          NULLIF(trim(to_jsonb(t)->>'employee_code'),     ''),
          NULLIF(trim(to_jsonb(t)->>'contractor_code'),   ''),
          NULLIF(trim(to_jsonb(t)->>'machine_code'),      ''),
          NULLIF(trim(to_jsonb(t)->>'reference_number'),  ''),
          NULLIF(trim(to_jsonb(t)->>'description'),       ''),
          NULLIF(trim(to_jsonb(t)->>'closing_date'),      '')
        ) AS title,
        COALESCE(
          (to_jsonb(t)->>'total_amount')::numeric,
          (to_jsonb(t)->>'contract_amount')::numeric,
          (to_jsonb(t)->>'net_amount')::numeric,
          (to_jsonb(t)->>'amount')::numeric,
          (to_jsonb(t)->>'physical_cash')::numeric,
          NULL
        ) AS amount,
        (to_jsonb(t)->>'project_id') AS project_id
      FROM public.%I t WHERE id = %L
      $q$,
      p_table_name, p_record_id
    ) INTO v_rec;

    IF v_rec IS NOT NULL THEN
      v_rec_title := COALESCE(v_rec.title, v_rec_title);
      v_amount := v_rec.amount;
      v_project_id := v_rec.project_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Keep fallback v_rec_title
  END;

  -- 5. Soft delete the main record
  v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  -- Cascade child items
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = p_record_id AND deleted_at IS NULL;
  END IF;

  -- 6. Audit log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'soft_delete', p_table_name, v_user_id, now(),
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    jsonb_build_object('soft_deleted', true, 'reason', p_reason, 'record_title', v_rec_title, 'amount', v_amount)
  );

  -- 7. Notify MD if deleted by non-MD
  IF NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id, reason,
      target_role, created_by, created_by_email, amount, details
    ) VALUES (
      'delete',
      format('Record Deleted: %s (%s)', v_rec_title, replace(p_table_name, '_', ' ')),
      format('%s deleted %s "%s"%s. Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        replace(p_table_name, '_', ' '),
        v_rec_title,
        CASE WHEN v_amount IS NOT NULL THEN format(' (₹%s)', v_amount) ELSE '' END,
        COALESCE(NULLIF(trim(p_reason), ''), 'No reason specified')
      ),
      p_table_name,
      p_record_id::text,
      p_reason,
      'md',
      v_user_id,
      v_user_email,
      v_amount,
      jsonb_build_object(
        'table', p_table_name,
        'record_id', p_record_id,
        'title', v_rec_title,
        'project_id', v_project_id,
        'amount', v_amount
      )
    );
  END IF;

  RETURN true;
END;
$function$;

-- Make 2-arg soft_delete_record delegate directly to the 3-arg version
CREATE OR REPLACE FUNCTION public.soft_delete_record(p_table_name text, p_record_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.soft_delete_record(p_table_name, p_record_id, NULL::text);
$function$;

-- 5. Update soft_delete_records (bulk delete) to also exclude voided records in dependency checks
CREATE OR REPLACE FUNCTION public.soft_delete_records(
  p_table_name text,
  p_record_ids uuid[],
  p_reason text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_wo integer;
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

  -- Step 2: Run dependency checks FIRST (excluding soft-deleted and voided records)
  FOREACH v_id IN ARRAY p_record_ids LOOP
    IF p_table_name = 'purchase_orders' THEN
      SELECT count(*) INTO v_grn FROM public.material_receipts WHERE po_id = v_id AND deleted_at IS NULL;
      SELECT count(*) INTO v_pay FROM public.supplier_payments WHERE po_id = v_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;
      IF v_grn > 0 OR v_pay > 0 THEN
        v_dep_msg := 'Cannot delete Purchase Order: ';
        IF v_grn > 0 THEN v_dep_msg := v_dep_msg || format('%s GRN(s) ', v_grn); END IF;
        IF v_pay > 0 THEN v_dep_msg := v_dep_msg || format('and %s active payment(s) ', v_pay); END IF;
        RAISE EXCEPTION '%', v_dep_msg || 'are linked to it. Delete or void dependent records first.';
      END IF;
    ELSIF p_table_name = 'work_orders' THEN
      SELECT count(*) INTO v_bills FROM public.contractor_bills WHERE work_order_id = v_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;
      IF v_bills > 0 THEN
        RAISE EXCEPTION 'Cannot delete Work Order: % active Contractor Bill(s) linked. Delete or void bills first.', v_bills;
      END IF;
    ELSIF p_table_name = 'contractor_bills' THEN
      SELECT count(*) INTO v_pay FROM public.contractor_payments WHERE bill_id = v_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;
      IF v_pay > 0 THEN
        RAISE EXCEPTION 'Cannot delete Contractor Bill: % active Payment(s) linked. Delete or void payments first.', v_pay;
      END IF;
    ELSIF p_table_name = 'projects' THEN
      SELECT count(*) INTO v_wo FROM public.work_orders WHERE project_id = v_id AND deleted_at IS NULL;
      SELECT count(*) INTO v_grn FROM public.purchase_orders WHERE project_id = v_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;
      SELECT count(*) INTO v_pay FROM public.client_payments WHERE project_id = v_id AND deleted_at IS NULL AND COALESCE(is_void, false) = false;
      IF v_wo > 0 OR v_grn > 0 OR v_pay > 0 THEN
        RAISE EXCEPTION 'Cannot delete Project: Has % active Work Order(s), % active PO(s), and % active Client Payment(s). Delete or void project records first.', v_wo, v_grn, v_pay;
      END IF;
    END IF;
  END LOOP;

  -- Step 3: All dependency checks passed. Now delete and collect titles.
  FOREACH v_id IN ARRAY p_record_ids LOOP
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
    END IF;

    v_rec_title := NULL;
    v_rec_amount := NULL;
    BEGIN
      EXECUTE format(
        $q$
        SELECT
          COALESCE(
            NULLIF(trim(to_jsonb(t)->>'po_number'),         ''),
            NULLIF(trim(to_jsonb(t)->>'request_number'),    ''),
            NULLIF(trim(to_jsonb(t)->>'receipt_number'),    ''),
            NULLIF(trim(to_jsonb(t)->>'bill_number'),       ''),
            NULLIF(trim(to_jsonb(t)->>'work_order_number'), ''),
            NULLIF(trim(to_jsonb(t)->>'mb_number'),         ''),
            NULLIF(trim(to_jsonb(t)->>'name'),              ''),
            NULLIF(trim(to_jsonb(t)->>'full_name'),         ''),
            NULLIF(trim(to_jsonb(t)->>'project_code'),      ''),
            NULLIF(trim(to_jsonb(t)->>'reference_number'),  ''),
            NULLIF(trim(to_jsonb(t)->>'description'),       '')
          ) AS title,
          COALESCE(
            (to_jsonb(t)->>'total_amount')::numeric,
            (to_jsonb(t)->>'contract_amount')::numeric,
            (to_jsonb(t)->>'net_amount')::numeric,
            (to_jsonb(t)->>'amount')::numeric,
            NULL
          ) AS amount
        FROM public.%I t WHERE id = %L
        $q$,
        p_table_name, v_id
      ) INTO v_rec;
      v_rec_title  := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(v_id::text, 1, 8));
      v_rec_amount := v_rec.amount;
    EXCEPTION WHEN OTHERS THEN
      v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(v_id::text, 1, 8);
    END;

    v_titles       := v_titles || ARRAY[v_rec_title];
    v_total_amount := v_total_amount + COALESCE(v_rec_amount, 0);

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
      format('Deleted %s %s', v_count, initcap(replace(p_table_name, '_', ' '))),
      format('%s deleted %s %s record(s): %s.%s Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        v_count,
        initcap(replace(p_table_name, '_', ' ')),
        array_to_string(v_titles, ', '),
        CASE WHEN v_total_amount > 0 THEN format(' Total amount: Rs.%s.', v_total_amount) ELSE '' END,
        COALESCE(NULLIF(trim(p_reason), ''), 'No reason specified')
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
$function$;
