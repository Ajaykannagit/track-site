-- =========================================================================
-- MIGRATION: 20261122010000_soft_delete_and_view_fixes.sql
-- =========================================================================

-- 1. Ensure deleted_at and work_order_id exist across tables
ALTER TABLE public.measurement_books ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contractor_bills ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contractor_bills ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.payment_milestones ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Grant permissions on payment_milestones and contractor_bills to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;

-- 3. Update attendance_view by dropping it first (PostgreSQL does not allow CREATE OR REPLACE VIEW to reorder/insert columns)
DROP VIEW IF EXISTS public.attendance_view CASCADE;

CREATE VIEW public.attendance_view AS
SELECT
  id,
  project_id,
  attendance_date,
  employee_id,
  contractor_id,
  kind,
  status,
  working_hours,
  ot_hours,
  CASE
    WHEN public.is_finance_user() OR public.has_role(auth.uid(), 'accounts') THEN wage_rate
    ELSE 0
  END AS wage_rate,
  CASE
    WHEN public.is_finance_user() OR public.has_role(auth.uid(), 'accounts') THEN calculated_wage
    ELSE 0
  END AS calculated_wage,
  photo_path,
  remarks,
  workforce_count,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at,
  in_time,
  out_time,
  site_id,
  site_name,
  day_value,
  is_leave
FROM public.attendance
WHERE deleted_at IS NULL;

GRANT SELECT ON public.attendance_view TO authenticated;

-- 4. Update soft_delete_record for work_orders and measurement_books
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_authorized boolean;
  v_sql text;
  v_rec record;
  v_rec_title text := 'Record';
  v_amount numeric(14,2) := NULL;
  v_project_id text := NULL;
  v_grn_count integer := 0;
  v_pay_count integer := 0;
  v_bill_count integer := 0;
  v_wo_count integer := 0;
  v_dep_msg text := '';
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

  -- 3. Strict Dependency Checks
  IF p_table_name = 'purchase_orders' THEN
    SELECT count(*) INTO v_grn_count FROM public.material_receipts WHERE po_id = p_record_id AND deleted_at IS NULL;
    SELECT count(*) INTO v_pay_count FROM public.supplier_payments WHERE po_id = p_record_id AND deleted_at IS NULL;
    IF v_grn_count > 0 OR v_pay_count > 0 THEN
      v_dep_msg := 'Cannot delete Purchase Order: ';
      IF v_grn_count > 0 THEN v_dep_msg := v_dep_msg || format('%s Goods Receipt(s) ', v_grn_count); END IF;
      IF v_pay_count > 0 THEN v_dep_msg := v_dep_msg || format('and %s Supplier Payment(s) ', v_pay_count); END IF;
      v_dep_msg := v_dep_msg || 'are linked to it. Delete or reassign dependent records first.';
      RAISE EXCEPTION '%', v_dep_msg;
    END IF;

  ELSIF p_table_name = 'work_orders' THEN
    SELECT count(*) INTO v_bill_count FROM public.contractor_bills WHERE work_order_id = p_record_id AND deleted_at IS NULL;
    IF v_bill_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Work Order: % Contractor Bill(s) are linked to it. Delete dependent bills first.', v_bill_count;
    END IF;

  ELSIF p_table_name = 'contractor_bills' THEN
    SELECT count(*) INTO v_pay_count FROM public.contractor_payments WHERE bill_id = p_record_id AND deleted_at IS NULL;
    IF v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Contractor Bill: % Payment(s) are linked to it. Delete payments first.', v_pay_count;
    END IF;

  ELSIF p_table_name = 'projects' THEN
    SELECT count(*) INTO v_wo_count FROM public.work_orders WHERE project_id = p_record_id AND deleted_at IS NULL;
    SELECT count(*) INTO v_grn_count FROM public.purchase_orders WHERE project_id = p_record_id AND deleted_at IS NULL;
    SELECT count(*) INTO v_pay_count FROM public.client_payments WHERE project_id = p_record_id AND deleted_at IS NULL;
    IF v_wo_count > 0 OR v_grn_count > 0 OR v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete Project: Has % active Work Order(s), % PO(s), and % Client Payment(s). Delete project records first.', v_wo_count, v_grn_count, v_pay_count;
    END IF;
  END IF;

  -- 4. Retrieve info for notification
  BEGIN
    EXECUTE format('
      SELECT 
        COALESCE(
          (to_jsonb(t)->>''po_number''),
          (to_jsonb(t)->>''bill_number''),
          (to_jsonb(t)->>''receipt_number''),
          (to_jsonb(t)->>''work_order_number''),
          (to_jsonb(t)->>''mb_number''),
          (to_jsonb(t)->>''name''),
          (to_jsonb(t)->>''full_name''),
          (to_jsonb(t)->>''description''),
          %L
        ) as title,
        COALESCE(
          (to_jsonb(t)->>''total_amount'')::numeric,
          (to_jsonb(t)->>''contract_amount'')::numeric,
          (to_jsonb(t)->>''amount'')::numeric,
          NULL
        ) as amount,
        (to_jsonb(t)->>''project_id'') as project_id
      FROM public.%I t WHERE id = %L',
      p_table_name || ' #' || substr(p_record_id::text, 1, 8),
      p_table_name, p_record_id
    ) INTO v_rec;

    IF v_rec IS NOT NULL THEN
      v_rec_title := COALESCE(v_rec.title, p_table_name);
      v_amount := v_rec.amount;
      v_project_id := v_rec.project_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback gracefully
  END;

  -- 5. Soft delete the main record
  v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

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
        COALESCE(trim(p_reason), 'No reason specified')
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
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid, text) TO authenticated;
