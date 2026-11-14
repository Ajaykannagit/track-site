-- =========================================================================
-- MIGRATION: 20261114000000_core_updates_and_powers.sql
-- PURPOSE:
--   1. Add staff_type (labour, supervisor, officer) to employees & classify existing.
--   2. Add travel_charges to purchase_orders and gst_percent to purchase_order_items.
--   3. Add payment_source ('bank', 'petty_cash') with NO default to all money movement tables.
--   4. Create account_opening_balances table for Bank & Petty Cash.
--   5. Create md_investments table for MD equity/capital inflow.
--   6. Upgrade soft_delete_record & add soft_delete_records with strict dependency checks,
--      support for Accounts role direct delete, and atomic MD-only notifications.
--   7. Secure notifications table & audit logs: MD-only SELECT.
--   8. Add get_account_balances() & get_md_dashboard_financials() RPCs.
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: Staff Type Classification
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'staff_type_enum'
  ) THEN
    CREATE TYPE public.staff_type_enum AS ENUM ('labour', 'supervisor', 'officer');
  END IF;
END $$;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS staff_type text;

-- Classify existing employees based on employee_type and designation:
UPDATE public.employees
SET staff_type = CASE
  WHEN lower(COALESCE(designation, '')) LIKE '%supervisor%' THEN 'supervisor'
  WHEN lower(COALESCE(designation, '')) LIKE '%manager%' 
    OR lower(COALESCE(designation, '')) LIKE '%engineer%'
    OR lower(COALESCE(designation, '')) LIKE '%officer%'
    OR lower(COALESCE(designation, '')) LIKE '%accountant%'
    OR employee_type = 'office' THEN 'officer'
  ELSE 'labour'
END
WHERE staff_type IS NULL;

ALTER TABLE public.employees ALTER COLUMN staff_type SET DEFAULT 'labour';
ALTER TABLE public.employees ALTER COLUMN staff_type SET NOT NULL;
ALTER TABLE public.employees ADD CONSTRAINT chk_employees_staff_type CHECK (staff_type IN ('labour', 'supervisor', 'officer'));

-- Update employees_view to include staff_type
DROP VIEW IF EXISTS public.employees_view CASCADE;
CREATE OR REPLACE VIEW public.employees_view AS
SELECT
  id,
  employee_code,
  full_name,
  employee_type,
  staff_type,
  designation,
  wage_type,
  CASE
    WHEN public.is_finance_user() OR public.has_role(auth.uid(), 'accounts') THEN wage_rate
    ELSE 0
  END AS wage_rate,
  CASE
    WHEN public.is_finance_user() OR public.has_role(auth.uid(), 'accounts') THEN ot_rate_per_hour
    ELSE NULL
  END AS ot_rate_per_hour,
  phone,
  address,
  active,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at,
  team_id,
  photo_url,
  emergency_contact,
  bank_account,
  aadhar_number,
  pf_number,
  esic_number,
  joining_date
FROM public.employees
WHERE deleted_at IS NULL;

GRANT SELECT ON public.employees_view TO authenticated;

-- -------------------------------------------------------------------------
-- PART 2: Purchase Order Travel Charges & Line Item GST
-- -------------------------------------------------------------------------
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS travel_charges numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS gst_percent numeric(5,2) NOT NULL DEFAULT 0;

-- -------------------------------------------------------------------------
-- PART 3: Payment Source on Money Movement Tables (Mandatory Bank / Petty Cash)
-- -------------------------------------------------------------------------
-- Tables affected:
-- expenses, client_payments, supplier_payments, contractor_payments,
-- subcontractor_payments, wage_payments, labour_wage_payments,
-- weekly_wage_adjustments, group_payments, account_transfers

DO $$
DECLARE
  tbl text;
  money_tables text[] := ARRAY[
    'expenses',
    'client_payments',
    'supplier_payments',
    'contractor_payments',
    'subcontractor_payments',
    'wage_payments',
    'labour_wage_payments',
    'weekly_wage_adjustments',
    'group_payments'
  ];
BEGIN
  FOREACH tbl IN ARRAY money_tables LOOP
    -- Add column nullable first
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS payment_source text;', tbl);
    -- Backfill existing rows safely regardless of whether table has payment_method or payment_mode
    EXECUTE format('
      UPDATE public.%I
      SET payment_source = CASE
        WHEN (to_jsonb(public.%I.*)->>''payment_method'') ILIKE ''%%cash%%'' 
          OR (to_jsonb(public.%I.*)->>''payment_mode'') ILIKE ''%%cash%%'' THEN ''petty_cash''
        ELSE ''bank''
      END
      WHERE payment_source IS NULL;
    ', tbl, tbl, tbl);
    -- Add check constraint if not exists
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT chk_%I_payment_source CHECK (payment_source IN (''bank'', ''petty_cash''));', tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN
      -- constraint already exists
    END;
    -- Make NOT NULL with NO DEFAULT
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN payment_source SET NOT NULL;', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN payment_source DROP DEFAULT;', tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PART 4: Account Opening Balances Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL UNIQUE CHECK (account_type IN ('bank', 'petty_cash')),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_opening_balances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_opening_balances' AND policyname = 'aob_select'
  ) THEN
    CREATE POLICY "aob_select" ON public.account_opening_balances
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_opening_balances' AND policyname = 'aob_write'
  ) THEN
    CREATE POLICY "aob_write" ON public.account_opening_balances
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.account_opening_balances TO authenticated;

-- Seed default 0 opening balances if missing
INSERT INTO public.account_opening_balances (account_type, opening_balance, as_of_date)
VALUES ('bank', 0, CURRENT_DATE), ('petty_cash', 0, CURRENT_DATE)
ON CONFLICT (account_type) DO NOTHING;

-- -------------------------------------------------------------------------
-- PART 5: MD Investments Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
  reference_number text,
  remarks text,
  is_void boolean NOT NULL DEFAULT false,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.md_investments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'md_investments' AND policyname = 'mdi_select'
  ) THEN
    CREATE POLICY "mdi_select" ON public.md_investments
      FOR SELECT TO authenticated USING (deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'md_investments' AND policyname = 'mdi_write'
  ) THEN
    CREATE POLICY "mdi_write" ON public.md_investments
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.md_investments TO authenticated;

-- Ensure new expense categories exist
INSERT INTO public.expense_categories (name) VALUES
  ('Advertisement & Marketing'),
  ('Commission'),
  ('Loading'),
  ('Bank Charges')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- PART 6: Upgrade Notifications Table & Policies (MD ONLY SELECT)
-- -------------------------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS amount numeric(14,2);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_md_only_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_md());

DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications_insert_all" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications update" ON public.notifications;
CREATE POLICY "notifications_md_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_md())
  WITH CHECK (public.is_md());

-- -------------------------------------------------------------------------
-- PART 7: Upgraded soft_delete_record & Dependency Check
-- -------------------------------------------------------------------------
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

  -- 3. Strict Dependency Checks (Block with clear detailed message)
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

  -- 4. Retrieve info for notification before deleting
  BEGIN
    EXECUTE format('
      SELECT 
        COALESCE(
          (to_jsonb(t)->>''po_number''),
          (to_jsonb(t)->>''bill_number''),
          (to_jsonb(t)->>''receipt_number''),
          (to_jsonb(t)->>''work_order_number''),
          (to_jsonb(t)->>''name''),
          (to_jsonb(t)->>''full_name''),
          (to_jsonb(t)->>''description''),
          %L
        ) as title,
        COALESCE(
          (to_jsonb(t)->>''total_amount'')::numeric,
          (to_jsonb(t)->>''amount'')::numeric,
          (to_jsonb(t)->>''amount_paid'')::numeric,
          (to_jsonb(t)->>''advance_paid'')::numeric,
          (to_jsonb(t)->>''calculated_wage'')::numeric,
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

  -- 6. Cascade soft delete to child line items if applicable
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'group_payments' THEN
    UPDATE public.group_payment_allocations SET deleted_at = now() WHERE group_payment_id = p_record_id AND deleted_at IS NULL;
  END IF;

  -- 7. Audit log (MD & Admin visibility)
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'soft_delete', p_table_name, v_user_id, now(),
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    jsonb_build_object('soft_deleted', true, 'reason', p_reason, 'record_title', v_rec_title, 'amount', v_amount)
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

-- -------------------------------------------------------------------------
-- PART 8: Bulk Soft Delete (ONE combined notification to MD per bulk operation)
-- -------------------------------------------------------------------------
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

    -- Collect record title for bulk summary
    BEGIN
      EXECUTE format('
        SELECT
          COALESCE(
            (to_jsonb(t)->>''po_number''),
            (to_jsonb(t)->>''bill_number''),
            (to_jsonb(t)->>''receipt_number''),
            (to_jsonb(t)->>''name''),
            (to_jsonb(t)->>''full_name''),
            (to_jsonb(t)->>''description''),
            %L
          ) as title,
          COALESCE(
            (to_jsonb(t)->>''total_amount'')::numeric,
            (to_jsonb(t)->>''amount'')::numeric,
            NULL
          ) as amount
        FROM public.%I t WHERE id = %L',
        ''#'' || substr(v_id::text, 1, 8), p_table_name, v_id
      ) INTO v_rec;
      v_rec_title := COALESCE(v_rec.title, ''#'' || substr(v_id::text, 1, 8));
      v_rec_amount := v_rec.amount;
      v_titles := v_titles || ARRAY[v_rec_title];
      v_total_amount := v_total_amount + COALESCE(v_rec_amount, 0);
    EXCEPTION WHEN OTHERS THEN
      v_titles := v_titles || ARRAY[substr(v_id::text, 1, 8)];
    END;

    -- Audit log per record
    INSERT INTO public.audit_logs (
      table_name, record_id, action, module, performed_by, performed_at, user_role, details
    ) VALUES (
      p_table_name, v_id, 'soft_delete', p_table_name, v_user_id, now(),
      CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
      jsonb_build_object('soft_deleted', true, 'reason', p_reason, 'bulk_delete', true)
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
      format('Bulk Delete: %s %s record(s) deleted', v_count, replace(p_table_name, '_', ' ')),
      format('%s deleted %s %s record(s): %s.%s Reason: %s',
        COALESCE(v_user_email, 'Accountant'),
        v_count,
        replace(p_table_name, '_', ' '),
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

-- -------------------------------------------------------------------------
-- PART 9: Running Account Balances RPC (Zero Double Counting)
-- -------------------------------------------------------------------------
-- Bank & Petty Cash calculations:
-- Opening Balance (account_opening_balances)
-- + Client Receipts (client_payments where is_void = false and deleted_at IS NULL)
-- + MD Investments (md_investments where is_void = false and deleted_at IS NULL)
-- + Transfers IN (account_transfers where to_account = target and is_void = false and deleted_at IS NULL)
-- - Expenses (expenses where is_void = false and deleted_at IS NULL)
-- - Supplier Payments (direct supplier_payments where is_void = false and deleted_at IS NULL and group_payment_id IS NULL)
-- - Contractor Payments (direct contractor_payments where is_void = false and deleted_at IS NULL and group_payment_id IS NULL)
-- - Subcontractor Payments (subcontractor_payments where is_void = false and deleted_at IS NULL)
-- - Group Payments (group_payments headers where is_void = false and deleted_at IS NULL)
-- - Wage Payments (labour_wage_payments where is_void = false and deleted_at IS NULL)
-- - Legacy Wage Payments (wage_payments where deleted_at IS NULL)
-- - Transfers OUT (account_transfers where from_account = target and is_void = false and deleted_at IS NULL)

CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE (
  account_type text,
  opening_balance numeric,
  total_inflows numeric,
  total_outflows numeric,
  current_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sources text[] := ARRAY['bank', 'petty_cash'];
  v_src text;
  v_open numeric;
  v_inflows numeric;
  v_outflows numeric;
  v_client_rec numeric;
  v_md_inv numeric;
  v_trans_in numeric;
  v_trans_out numeric;
  v_exp numeric;
  v_sp numeric;
  v_cp numeric;
  v_subp numeric;
  v_gp numeric;
  v_lwp numeric;
  v_wp numeric;
  v_adv numeric;
BEGIN
  FOREACH v_src IN ARRAY v_sources LOOP
    -- 1. Opening balance
    SELECT COALESCE(a.opening_balance, 0) INTO v_open
    FROM public.account_opening_balances a
    WHERE a.account_type = v_src;
    v_open := COALESCE(v_open, 0);

    -- 2. Client Receipts
    SELECT COALESCE(SUM(amount), 0) INTO v_client_rec
    FROM public.client_payments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

    -- 3. MD Investments
    SELECT COALESCE(SUM(amount), 0) INTO v_md_inv
    FROM public.md_investments
    WHERE payment_source = v_src AND is_void = false AND deleted_at IS NULL;

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

    -- Supplier payments (exclude if part of group payment to avoid double counting)
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

    -- Labour wage payments (actual cash/bank disbursements)
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

    -- Worker advances (actual cash/bank handed over when advance was paid)
    SELECT COALESCE(SUM(advance_paid), 0) INTO v_adv
    FROM public.weekly_wage_adjustments
    WHERE payment_source = v_src AND advance_paid > 0 AND deleted_at IS NULL;

    v_outflows := v_exp + v_sp + v_cp + v_subp + v_gp + v_lwp + v_wp + v_adv + v_trans_out;

    account_type := v_src;
    opening_balance := v_open;
    total_inflows := v_inflows;
    total_outflows := v_outflows;
    current_balance := v_open + v_inflows - v_outflows;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balances() TO authenticated;

-- -------------------------------------------------------------------------
-- PART 10: MD Financial Dashboard RPC (Strict Backend Authorization)
-- Non-MD roles receive NULL or an error; Accounts gets NO money numbers.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_md_dashboard_financials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_md boolean;
  v_total_contract_value numeric := 0;
  v_total_spent numeric := 0;
  v_receivables_due numeric := 0;
  v_bank_balance numeric := 0;
  v_petty_cash_balance numeric := 0;
  v_balances record;
BEGIN
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Access denied. MD dashboard financials are restricted to Managing Director.';
  END IF;

  -- 1. Total contract value (base project quotation + active quotations)
  SELECT COALESCE(SUM(quotation_amount), 0) INTO v_total_contract_value
  FROM public.projects WHERE deleted_at IS NULL;

  v_total_contract_value := v_total_contract_value + (
    SELECT COALESCE(SUM(amount), 0) FROM public.project_quotations WHERE deleted_at IS NULL
  );

  -- 2. Balances from running balances function
  FOR v_balances IN SELECT * FROM public.get_account_balances() LOOP
    IF v_balances.account_type = 'bank' THEN
      v_bank_balance := v_balances.current_balance;
    ELSIF v_balances.account_type = 'petty_cash' THEN
      v_petty_cash_balance := v_balances.current_balance;
    END IF;
  END LOOP;

  -- 3. Total spend (all outflows across bank & petty cash excluding transfers)
  SELECT 
    COALESCE(SUM(total_outflows), 0) INTO v_total_spent
  FROM public.get_account_balances();

  -- 4. Receivables due = Contract Value - Client Receipts
  SELECT (v_total_contract_value - COALESCE(SUM(amount), 0)) INTO v_receivables_due
  FROM public.client_payments
  WHERE is_void = false AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'total_contract_value', v_total_contract_value,
    'total_spent', v_total_spent,
    'receivables_due', GREATEST(v_receivables_due, 0),
    'bank_balance', v_bank_balance,
    'petty_cash_balance', v_petty_cash_balance,
    'total_cash_and_bank', v_bank_balance + v_petty_cash_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_md_dashboard_financials() TO authenticated;


-- -------------------------------------------------------------------------
-- PART 11: Upgrade create_group_payment to require payment_source (Bank / Petty Cash)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_payment(
  p_payment_type text,
  p_party_id uuid, -- contractor_id or supplier_id
  p_payment_date date,
  p_total_amount numeric,
  p_payment_mode text,
  p_reference_number text,
  p_bank_account_id text,
  p_remarks text,
  p_allocations jsonb, -- array of { project_id, work_order_id, contractor_bill_id, po_id, allocated_amount, remarks }
  p_payment_source text DEFAULT 'bank'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean;
  v_group_id uuid;
  v_payment_number text;
  v_seq integer;
  v_sum_alloc numeric := 0;
  v_alloc record;
  v_source text;
BEGIN
  -- 1. Authorization: MD or Accounts
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Accounts or MD can record group payments.';
  END IF;

  -- 2. Validate input
  IF p_payment_type NOT IN ('contractor', 'supplier') THEN
    RAISE EXCEPTION 'Invalid payment type: %', p_payment_type;
  END IF;

  v_source := lower(COALESCE(p_payment_source, 'bank'));
  IF v_source NOT IN ('bank', 'petty_cash') THEN
    RAISE EXCEPTION 'Invalid payment source: %. Must be "bank" or "petty_cash".', p_payment_source;
  END IF;

  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero.';
  END IF;

  IF jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one allocation item is required.';
  END IF;

  -- 3. Calculate sum of allocations and validate
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS (
    project_id uuid,
    work_order_id uuid,
    contractor_bill_id uuid,
    po_id uuid,
    allocated_amount numeric,
    remarks text
  ) LOOP
    IF v_alloc.allocated_amount <= 0 THEN
      RAISE EXCEPTION 'Each allocated amount must be positive.';
    END IF;
    v_sum_alloc := v_sum_alloc + v_alloc.allocated_amount;
  END LOOP;

  IF abs(v_sum_alloc - p_total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Sum of allocations (%) does not equal total payment amount (%).', v_sum_alloc, p_total_amount;
  END IF;

  -- 4. Generate unique payment number
  SELECT nextval('public.group_payment_number_seq') INTO v_seq;
  v_payment_number := 'GP-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  -- 5. Insert Parent Group Payment
  INSERT INTO public.group_payments (
    payment_number,
    payment_type,
    contractor_id,
    supplier_id,
    payment_date,
    total_amount,
    payment_mode,
    payment_source,
    reference_number,
    bank_account_id,
    remarks,
    created_by
  ) VALUES (
    v_payment_number,
    p_payment_type,
    CASE WHEN p_payment_type = 'contractor' THEN p_party_id ELSE NULL END,
    CASE WHEN p_payment_type = 'supplier' THEN p_party_id ELSE NULL END,
    p_payment_date,
    p_total_amount,
    p_payment_mode,
    v_source,
    p_reference_number,
    p_bank_account_id,
    p_remarks,
    v_user_id
  ) RETURNING id INTO v_group_id;

  -- 6. Insert Allocations & Corresponding Child Payment records for each project
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS (
    project_id uuid,
    work_order_id uuid,
    contractor_bill_id uuid,
    po_id uuid,
    allocated_amount numeric,
    remarks text
  ) LOOP
    -- Insert allocation record
    INSERT INTO public.group_payment_allocations (
      group_payment_id,
      project_id,
      work_order_id,
      contractor_bill_id,
      po_id,
      allocated_amount,
      remarks
    ) VALUES (
      v_group_id,
      v_alloc.project_id,
      v_alloc.work_order_id,
      v_alloc.contractor_bill_id,
      v_alloc.po_id,
      v_alloc.allocated_amount,
      v_alloc.remarks
    );

    -- Insert into individual project payment tables with payment_source
    IF p_payment_type = 'contractor' THEN
      INSERT INTO public.contractor_payments (
        group_payment_id,
        project_id,
        contractor_id,
        bill_id,
        payment_date,
        amount,
        payment_source,
        payment_mode,
        reference_number,
        remarks,
        created_by
      ) VALUES (
        v_group_id,
        v_alloc.project_id,
        p_party_id,
        v_alloc.contractor_bill_id,
        p_payment_date,
        v_alloc.allocated_amount,
        v_source,
        p_payment_mode,
        COALESCE(p_reference_number, v_payment_number),
        COALESCE(v_alloc.remarks, p_remarks, 'Group payment ' || v_payment_number),
        v_user_id
      );
    ELSE
      INSERT INTO public.supplier_payments (
        group_payment_id,
        project_id,
        supplier_id,
        po_id,
        payment_date,
        amount,
        payment_source,
        payment_mode,
        reference_number,
        remarks,
        created_by
      ) VALUES (
        v_group_id,
        v_alloc.project_id,
        p_party_id,
        v_alloc.po_id,
        p_payment_date,
        v_alloc.allocated_amount,
        v_source,
        p_payment_mode,
        COALESCE(p_reference_number, v_payment_number),
        COALESCE(v_alloc.remarks, p_remarks, 'Group payment ' || v_payment_number),
        v_user_id
      );
    END IF;
  END LOOP;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    'group_payments', v_group_id, 'insert', 'finance', v_user_id, now(),
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    jsonb_build_object(
      'payment_number', v_payment_number,
      'payment_type', p_payment_type,
      'total_amount', p_total_amount,
      'payment_source', v_source,
      'allocations_count', jsonb_array_length(p_allocations)
    )
  );

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_payment(text, uuid, date, numeric, text, text, text, text, jsonb, text) TO authenticated;
