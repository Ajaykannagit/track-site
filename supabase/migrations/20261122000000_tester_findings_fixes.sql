-- MIGRATION: 20261122000000_tester_findings_fixes.sql
-- Description:
-- 1. Create public.group_payment_number_seq idempotently and grant usage & select to authenticated.
-- 2. Audit logs RLS: Allow MD and Accountant to read audit logs.
-- 3. Soft delete records & record: Fix record title resolution, eliminate empty title fallback,
--    and record the actor's email properly in audit_logs and notifications.
-- 4. Role protection: Enforce at DB level that only MD can grant, update, or revoke the 'md' role.
-- 5. Material receipts view: Ensure explicit SELECT grant to authenticated.

-- ============================================================================
-- 1. GROUP PAYMENT SEQUENCE & PAYMENT METHOD/MODE COLUMNS
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.group_payment_number_seq START WITH 1000 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.group_payment_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.group_payment_number_seq TO service_role;

-- Ensure payment_method and payment_mode exist on both contractor_payments and supplier_payments
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS payment_mode text;

ALTER TABLE public.contractor_payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.contractor_payments ADD COLUMN IF NOT EXISTS payment_mode text;

-- Sync columns if one exists and the other is null
UPDATE public.supplier_payments SET payment_method = COALESCE(payment_method, payment_mode) WHERE payment_method IS NULL;
UPDATE public.supplier_payments SET payment_mode = COALESCE(payment_mode, payment_method) WHERE payment_mode IS NULL;

UPDATE public.contractor_payments SET payment_method = COALESCE(payment_method, payment_mode) WHERE payment_method IS NULL;
UPDATE public.contractor_payments SET payment_mode = COALESCE(payment_mode, payment_method) WHERE payment_mode IS NULL;

-- ============================================================================
-- 2. AUDIT LOGS ACCESS (Allow MD and Accountant)
-- ============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'));

DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid() OR auth.uid() IS NULL);

-- ============================================================================
-- 3. USER ROLES SECURITY (Accountant cannot assign/alter/delete MD role)
-- ============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;
CREATE POLICY "user_roles_write_policy" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_md() OR (
      public.has_role(auth.uid(), 'accounts') AND role != 'md'
    )
  )
  WITH CHECK (
    public.is_md() OR (
      public.has_role(auth.uid(), 'accounts') AND role != 'md'
    )
  );

-- ============================================================================
-- 4. MATERIAL RECEIPTS VIEW GRANT RE-ASSERTION
-- ============================================================================
GRANT SELECT ON public.material_receipts_view TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_receipt_items TO authenticated;

-- ============================================================================
-- 5. SOFT DELETE FUNCTIONS (Fix notification titles & audit details)
-- ============================================================================
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
  v_rec_title text := NULL;
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
    SELECT count(*) INTO v_pay_count FROM public.contractor_payments WHERE work_order_id = p_record_id AND deleted_at IS NULL;
    IF v_bill_count > 0 OR v_pay_count > 0 THEN
      v_dep_msg := 'Cannot delete Work Order: ';
      IF v_bill_count > 0 THEN v_dep_msg := v_dep_msg || format('%s Contractor Bill(s) ', v_bill_count); END IF;
      IF v_pay_count > 0 THEN v_dep_msg := v_dep_msg || format('and %s Contractor Payment(s) ', v_pay_count); END IF;
      v_dep_msg := v_dep_msg || 'are linked to it. Delete or reassign dependent records first.';
      RAISE EXCEPTION '%', v_dep_msg;
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

  -- 4. Retrieve info for notification before deleting
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
          NULLIF(trim(to_jsonb(t)->>'invoice_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'reference_number'), ''),
          NULLIF(trim(to_jsonb(t)->>'name'), ''),
          NULLIF(trim(to_jsonb(t)->>'full_name'), ''),
          NULLIF(trim(to_jsonb(t)->>'description'), ''),
          NULLIF(trim(to_jsonb(t)->>'work_description'), '')
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
        ) AS amount,
        (to_jsonb(t)->>'project_id') AS project_id
      FROM public.%I t WHERE id = %L
      $q$,
      p_table_name, p_record_id
    ) INTO v_rec;

    IF v_rec IS NOT NULL THEN
      v_rec_title := COALESCE(v_rec.title, upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8));
      v_amount := v_rec.amount;
      v_project_id := v_rec.project_id;
    ELSE
      v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_rec_title := upper(replace(p_table_name, '_', ' ')) || ' #' || substr(p_record_id::text, 1, 8);
  END;

  -- 5. Soft delete the main record
  v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  -- 6. Cascade soft delete to child line items
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'group_payments' THEN
    UPDATE public.group_payment_allocations SET deleted_at = now() WHERE group_payment_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'measurement_books' THEN
    UPDATE public.measurement_items SET deleted_at = now() WHERE mb_id = p_record_id AND deleted_at IS NULL;
  END IF;

  -- 7. Audit log (MD & Admin visibility)
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details, reason
  ) VALUES (
    p_table_name, p_record_id, 'soft_delete', p_table_name, v_user_id, now(),
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    jsonb_build_object(
      'soft_deleted', true,
      'reason', COALESCE(trim(p_reason), 'No reason specified'),
      'record_title', v_rec_title,
      'amount', v_amount,
      'performer_email', v_user_email
    ),
    COALESCE(trim(p_reason), 'No reason specified')
  );

  -- 8. If deleted by Accounts (or anyone other than MD), notify MD ONLY
  IF NOT public.is_md() THEN
    INSERT INTO public.notifications (
      type,
      title,
      message,
      table_name,
      record_id,
      reason,
      target_role,
      created_by,
      created_by_email,
      amount,
      details
    ) VALUES (
      'delete',
      format('Record Deleted: %s (%s)', v_rec_title, initcap(replace(p_table_name, '_', ' '))),
      format('%s deleted %s "%s"%s. Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        initcap(replace(p_table_name, '_', ' ')),
        v_rec_title,
        CASE WHEN v_amount IS NOT NULL THEN format(' (₹%s)', v_amount) ELSE '' END,
        COALESCE(trim(p_reason), 'No reason specified')
      ),
      p_table_name,
      p_record_id::text,
      COALESCE(trim(p_reason), 'No reason specified'),
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
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid, text) TO authenticated;
