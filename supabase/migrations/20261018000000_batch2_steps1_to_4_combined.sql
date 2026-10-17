-- =========================================================================
-- COMBINED ADDITIVE MIGRATION: BATCH 2 STEPS 1-4 & CLIENT PAYMENTS
-- Safe, idempotent, additive migration for Brickweld Track Site.
-- =========================================================================

-- IMPORTANT: Take a Supabase backup before executing this script!

-- -------------------------------------------------------------------------
-- PART 1: Client Payments & Payment Milestones Tables
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'bank',
  reference_number text,
  payment_category text NOT NULL DEFAULT 'progress',
  invoice_reference text,
  notes text,
  status text NOT NULL DEFAULT 'received',
  account_type text NOT NULL DEFAULT 'bank',
  is_demo boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_project_id ON public.client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON public.client_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_client_payments_status ON public.client_payments(status);

CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount >= 0),
  due_date date NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  is_demo boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_project_id ON public.payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_due_date ON public.payment_milestones(due_date);

-- -------------------------------------------------------------------------
-- PART 2: Wage Payments Table (Per Team Per Week)
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wage_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  week_start_date date NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  reference_number text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wage_payments_team_week ON public.wage_payments(team_id, week_start_date);

-- -------------------------------------------------------------------------
-- PART 3: Payment Method & Reference Columns (R1)
-- -------------------------------------------------------------------------

ALTER TABLE public.weekly_wage_adjustments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference_number text;

ALTER TABLE public.subcontractor_payments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference_number text;

-- -------------------------------------------------------------------------
-- PART 4: Soft-Delete Support (deleted_at) on Money & Operational Tables
-- -------------------------------------------------------------------------

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contractor_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contractor_bills ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.subcontractor_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.weekly_wage_adjustments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.cash_closing ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.material_receipts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.material_receipt_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.material_request_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_quotations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- -------------------------------------------------------------------------
-- PART 5: Partial Unique Indexes (Prevent blocking reuse of soft-deleted numbers)
-- -------------------------------------------------------------------------

DO $$
BEGIN
  -- Drop hard table constraints if they exist, replace with partial unique indexes
  ALTER TABLE public.client_payments DROP CONSTRAINT IF EXISTS client_payments_receipt_number_key;
  ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
  ALTER TABLE public.material_receipts DROP CONSTRAINT IF EXISTS material_receipts_receipt_number_key;
  ALTER TABLE public.contractor_bills DROP CONSTRAINT IF EXISTS contractor_bills_bill_number_key;
  ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_request_number_key;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_payments_receipt_number_active
  ON public.client_payments(receipt_number) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_orders_po_number_active
  ON public.purchase_orders(po_number) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_material_receipts_receipt_number_active
  ON public.material_receipts(receipt_number) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contractor_bills_bill_number_active
  ON public.contractor_bills(bill_number) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_material_requests_request_number_active
  ON public.material_requests(request_number) WHERE deleted_at IS NULL;

-- -------------------------------------------------------------------------
-- PART 6: MD-Only Soft Delete and Restore Stored Functions
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_md boolean;
  v_sql text;
  v_child_sql text;
BEGIN
  -- Strict role validation: Only MD can delete records
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) can delete records.';
  END IF;

  -- Whitelist allowable tables for soft delete
  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments'
  ) THEN
    RAISE EXCEPTION 'Table % does not support soft delete.', p_table_name;
  END IF;

  -- 1. Soft delete the main record
  v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  -- 2. Cascade soft-delete to child line items
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = p_record_id AND deleted_at IS NULL;
  END IF;

  -- 3. Write immutable audit log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'soft_delete', p_table_name, v_user_id, now(), 'md',
    jsonb_build_object('soft_deleted', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_record(
  p_table_name text,
  p_record_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_md boolean;
  v_sql text;
BEGIN
  -- Strict role validation: Only MD can restore records
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) can restore records.';
  END IF;

  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments'
  ) THEN
    RAISE EXCEPTION 'Table % does not support record restore.', p_table_name;
  END IF;

  -- 1. Restore the main record
  v_sql := format('UPDATE public.%I SET deleted_at = NULL WHERE id = %L AND deleted_at IS NOT NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  -- 2. Cascade restore child line items
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = NULL WHERE po_id = p_record_id;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = NULL WHERE receipt_id = p_record_id;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = NULL WHERE request_id = p_record_id;
  END IF;

  -- 3. Write immutable audit log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'restore', p_table_name, v_user_id, now(), 'md',
    jsonb_build_object('restored', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 7: Database-Level Audit Triggers for Money Tables
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_audit_money_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_action text := TG_OP;
  v_rec_id uuid;
  v_details jsonb;
  v_user_role text := 'authenticated';
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec_id := OLD.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := NEW.id;
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_rec_id := NEW.id;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  IF public.is_md() THEN
    v_user_role := 'md';
  ELSIF public.has_role(v_user_id, 'accounts') THEN
    v_user_role := 'accounts';
  ELSIF public.has_role(v_user_id, 'supervisor') THEN
    v_user_role := 'supervisor';
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    TG_TABLE_NAME, v_rec_id, v_action, TG_TABLE_NAME, v_user_id, now(), v_user_role, v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop and re-attach audit triggers cleanly
DO $$
DECLARE
  tbl text;
  money_tables text[] := ARRAY[
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'material_receipts', 'client_payments', 'wage_payments'
  ];
BEGIN
  FOREACH tbl IN ARRAY money_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_audit_money_entry()', tbl, tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PART 8: Audit Logs Table Security (MD-Only Read, Strict Insert Only)
-- -------------------------------------------------------------------------

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;

DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_md());

DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- PART 9: Granular Role Policies (SELECT, INSERT, UPDATE — NO DELETE)
-- -------------------------------------------------------------------------

-- Revoke direct DELETE privileges on all operational and money tables
DO $$
DECLARE
  tbl text;
  all_domain_tables text[] := ARRAY[
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_domain_tables LOOP
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', tbl);
  END LOOP;
END $$;

-- 9.1 Expenses Policies (Office expenses vs Project expenses)
DROP POLICY IF EXISTS "expenses read policy" ON public.expenses;
DROP POLICY IF EXISTS "finance write" ON public.expenses;
DROP POLICY IF EXISTS "expenses write policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses select policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses insert policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses update policy" ON public.expenses;

CREATE POLICY "expenses select policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md() OR
      (public.is_finance_user() AND project_id IS NOT NULL) OR
      (public.has_role(auth.uid(), 'accounts') AND project_id IS NULL AND created_by = auth.uid()) OR
      (public.has_role(auth.uid(), 'supervisor') AND project_id IS NOT NULL)
    )
  );

CREATE POLICY "expenses insert policy" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_md() OR
    public.has_role(auth.uid(), 'accounts') OR
    (public.has_role(auth.uid(), 'supervisor') AND project_id IS NOT NULL)
  );

CREATE POLICY "expenses update policy" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md() OR
      public.has_role(auth.uid(), 'accounts') OR
      (public.has_role(auth.uid(), 'supervisor') AND project_id IS NOT NULL)
    )
  )
  WITH CHECK (
    deleted_at IS NULL AND (
      public.is_md() OR
      public.has_role(auth.uid(), 'accounts') OR
      (public.has_role(auth.uid(), 'supervisor') AND project_id IS NOT NULL)
    )
  );

-- 9.2 Cash Closing Policies (Accountant sees only own entries, MD sees all)
DROP POLICY IF EXISTS "cash_closing read policy" ON public.cash_closing;
DROP POLICY IF EXISTS "finance write" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing select policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing insert policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing update policy" ON public.cash_closing;

CREATE POLICY "cash_closing select policy" ON public.cash_closing
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md() OR
      (public.has_role(auth.uid(), 'accounts') AND created_by = auth.uid())
    )
  );

CREATE POLICY "cash_closing insert policy" ON public.cash_closing
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_md() OR public.has_role(auth.uid(), 'accounts')
  );

CREATE POLICY "cash_closing update policy" ON public.cash_closing
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md() OR
      (public.has_role(auth.uid(), 'accounts') AND created_by = auth.uid())
    )
  )
  WITH CHECK (
    deleted_at IS NULL AND (
      public.is_md() OR
      (public.has_role(auth.uid(), 'accounts') AND created_by = auth.uid())
    )
  );

-- 9.3 Client Payments Policies
DROP POLICY IF EXISTS "client_payments read policy" ON public.client_payments;
DROP POLICY IF EXISTS "client_payments write policy" ON public.client_payments;
DROP POLICY IF EXISTS "client_payments select policy" ON public.client_payments;
DROP POLICY IF EXISTS "client_payments insert policy" ON public.client_payments;
DROP POLICY IF EXISTS "client_payments update policy" ON public.client_payments;

CREATE POLICY "client_payments select policy" ON public.client_payments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user());

CREATE POLICY "client_payments insert policy" ON public.client_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "client_payments update policy" ON public.client_payments
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user())
  WITH CHECK (deleted_at IS NULL AND public.is_finance_user());

-- 9.4 Payment Milestones Policies
DROP POLICY IF EXISTS "payment_milestones read policy" ON public.payment_milestones;
DROP POLICY IF EXISTS "payment_milestones write policy" ON public.payment_milestones;
DROP POLICY IF EXISTS "payment_milestones select policy" ON public.payment_milestones;
DROP POLICY IF EXISTS "payment_milestones insert policy" ON public.payment_milestones;
DROP POLICY IF EXISTS "payment_milestones update policy" ON public.payment_milestones;

CREATE POLICY "payment_milestones select policy" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user());

CREATE POLICY "payment_milestones insert policy" ON public.payment_milestones
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "payment_milestones update policy" ON public.payment_milestones
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user())
  WITH CHECK (deleted_at IS NULL AND public.is_finance_user());

-- 9.5 Wage Payments Policies
GRANT SELECT, INSERT, UPDATE ON public.wage_payments TO authenticated;
GRANT ALL ON public.wage_payments TO service_role;
ALTER TABLE public.wage_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wage_payments select policy" ON public.wage_payments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user());

CREATE POLICY "wage_payments insert policy" ON public.wage_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "wage_payments update policy" ON public.wage_payments
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user())
  WITH CHECK (deleted_at IS NULL AND public.is_finance_user());

-- 9.6 Contractor Bills, Contractor Payments, Supplier Payments, Purchase Orders, Weekly Wage Adjustments
DO $$
DECLARE
  fin_tbl text;
  fin_tables text[] := ARRAY[
    'contractor_bills', 'contractor_payments', 'supplier_payments',
    'subcontractor_payments', 'purchase_orders', 'purchase_order_items', 'weekly_wage_adjustments'
  ];
BEGIN
  FOREACH fin_tbl IN ARRAY fin_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance write" ON public.%I', fin_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I read policy" ON public.%I', fin_tbl, fin_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I select policy" ON public.%I', fin_tbl, fin_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I insert policy" ON public.%I', fin_tbl, fin_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I update policy" ON public.%I', fin_tbl, fin_tbl);

    EXECUTE format('CREATE POLICY "%I select policy" ON public.%I FOR SELECT TO authenticated USING (deleted_at IS NULL AND public.is_finance_user())', fin_tbl, fin_tbl);
    EXECUTE format('CREATE POLICY "%I insert policy" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_finance_user())', fin_tbl, fin_tbl);
    EXECUTE format('CREATE POLICY "%I update policy" ON public.%I FOR UPDATE TO authenticated USING (deleted_at IS NULL AND public.is_finance_user()) WITH CHECK (deleted_at IS NULL AND public.is_finance_user())', fin_tbl, fin_tbl);
  END LOOP;
END $$;

-- 9.7 Material Receipts, Material Requests, Attendance
DO $$
DECLARE
  ops_tbl text;
  ops_tables text[] := ARRAY[
    'attendance', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items'
  ];
BEGIN
  FOREACH ops_tbl IN ARRAY ops_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "site write" ON public.%I', ops_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I read policy" ON public.%I', ops_tbl, ops_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I select policy" ON public.%I', ops_tbl, ops_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I insert policy" ON public.%I', ops_tbl, ops_tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%I update policy" ON public.%I', ops_tbl, ops_tbl);

    EXECUTE format('CREATE POLICY "%I select policy" ON public.%I FOR SELECT TO authenticated USING (deleted_at IS NULL AND public.is_operations_user())', ops_tbl, ops_tbl);
    EXECUTE format('CREATE POLICY "%I insert policy" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_operations_user())', ops_tbl, ops_tbl);
    EXECUTE format('CREATE POLICY "%I update policy" ON public.%I FOR UPDATE TO authenticated USING (deleted_at IS NULL AND public.is_operations_user()) WITH CHECK (deleted_at IS NULL AND public.is_operations_user())', ops_tbl, ops_tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PART 10: Step 7 Sanitized Views Filter Update (Exclude Soft-Deleted Rows)
-- -------------------------------------------------------------------------

-- 10.1 Projects View
CREATE OR REPLACE VIEW public.projects_view AS
SELECT
  id,
  project_code,
  house_number,
  name,
  client_id,
  CASE
    WHEN public.is_finance_user() THEN quotation_amount
    ELSE 0
  END AS quotation_amount,
  agreement_details,
  details,
  start_date,
  expected_completion_date,
  site_address,
  latitude,
  longitude,
  status,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at,
  completion_percent,
  actual_completion_date,
  project_manager
FROM public.projects;

GRANT SELECT ON public.projects_view TO authenticated;

-- 10.2 Attendance View (excludes soft-deleted rows)
CREATE OR REPLACE VIEW public.attendance_view AS
SELECT
  id,
  attendance_date,
  employee_id,
  contractor_id,
  kind,
  status,
  working_hours,
  ot_hours,
  CASE
    WHEN public.is_finance_user() THEN wage_rate
    ELSE 0
  END AS wage_rate,
  CASE
    WHEN public.is_finance_user() THEN calculated_wage
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

-- 10.3 Material Receipts View (excludes soft-deleted rows)
CREATE OR REPLACE VIEW public.material_receipts_view AS
SELECT
  id,
  receipt_number,
  po_id,
  project_id,
  supplier_id,
  receipt_date,
  photo_path,
  remarks,
  CASE
    WHEN public.is_finance_user() THEN total_amount
    ELSE 0
  END AS total_amount,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at
FROM public.material_receipts
WHERE deleted_at IS NULL;

GRANT SELECT ON public.material_receipts_view TO authenticated;

-- 10.4 Material Requests View (excludes soft-deleted rows)
CREATE OR REPLACE VIEW public.material_requests_view AS
SELECT
  id,
  request_number,
  project_id,
  request_date,
  required_date,
  status,
  photo_path,
  remarks,
  CASE
    WHEN public.is_finance_user() THEN total_amount
    ELSE 0
  END AS total_amount,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at,
  material_name
FROM public.material_requests
WHERE deleted_at IS NULL;

GRANT SELECT ON public.material_requests_view TO authenticated;

-- 10.5 Employees View
CREATE OR REPLACE VIEW public.employees_view AS
SELECT
  id,
  employee_code,
  full_name,
  employee_type,
  designation,
  wage_type,
  CASE
    WHEN public.is_finance_user() THEN wage_rate
    ELSE 0
  END AS wage_rate,
  CASE
    WHEN public.is_finance_user() THEN ot_rate_per_hour
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
FROM public.employees;

GRANT SELECT ON public.employees_view TO authenticated;

-- -------------------------------------------------------------------------
-- PART 11: One-Time Data Migration of Demo Client Payments
-- (Copies demo client receipts from cash_closing to client_payments if not already copied)
-- -------------------------------------------------------------------------

INSERT INTO public.client_payments (
  id, receipt_number, project_id, amount, payment_date, payment_method,
  payment_category, notes, status, account_type, is_demo
)
SELECT
  cc.id,
  'RCP-DEMO-' || RIGHT(cc.id::text, 6),
  cc.project_id,
  cc.cash_received,
  cc.closing_date,
  'bank',
  'progress',
  cc.remarks,
  'received',
  'bank',
  true
FROM public.cash_closing cc
WHERE cc.account_type = 'project'
  AND cc.is_demo = true
  AND cc.cash_received > 0
  AND cc.project_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
