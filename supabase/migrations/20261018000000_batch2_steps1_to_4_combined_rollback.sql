-- =========================================================================
-- ROLLBACK SCRIPT FOR: 20261018000000_batch2_steps1_to_4_combined.sql
-- Safe rollback restoring pre-batch-2 state
-- =========================================================================

-- 1. Drop Audit Triggers
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
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.trg_audit_money_entry();

-- 2. Drop Soft Delete & Restore Functions
DROP FUNCTION IF EXISTS public.soft_delete_record(text, uuid);
DROP FUNCTION IF EXISTS public.restore_record(text, uuid);

-- 3. Re-grant DELETE to authenticated
DO $$
DECLARE
  tbl text;
  all_domain_tables text[] := ARRAY[
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_domain_tables LOOP
    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END $$;

-- 4. Restore original RLS policies
-- Expenses
DROP POLICY IF EXISTS "expenses select policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses insert policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses update policy" ON public.expenses;
CREATE POLICY "expenses read policy" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_md() OR (public.is_finance_user() AND project_id IS NOT NULL));
CREATE POLICY "finance write" ON public.expenses FOR ALL TO authenticated
  USING (public.can_write_finance()) WITH CHECK (public.can_write_finance());

-- Cash Closing
DROP POLICY IF EXISTS "cash_closing select policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing insert policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing update policy" ON public.cash_closing;
CREATE POLICY "cash_closing read policy" ON public.cash_closing FOR SELECT TO authenticated
  USING (public.is_md());
CREATE POLICY "finance write" ON public.cash_closing FOR ALL TO authenticated
  USING (public.can_write_finance()) WITH CHECK (public.can_write_finance());

-- Audit Logs
DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

-- 5. Drop New Tables
DROP TABLE IF EXISTS public.wage_payments;
DROP TABLE IF EXISTS public.payment_milestones;
DROP TABLE IF EXISTS public.client_payments;

-- 6. Restore original Step 7 views without deleted_at filter
CREATE OR REPLACE VIEW public.attendance_view AS
SELECT
  id, attendance_date, employee_id, contractor_id, kind, status, working_hours, ot_hours,
  CASE WHEN public.is_finance_user() THEN wage_rate ELSE 0 END AS wage_rate,
  CASE WHEN public.is_finance_user() THEN calculated_wage ELSE 0 END AS calculated_wage,
  photo_path, remarks, workforce_count, is_demo, created_by, created_at, updated_by, updated_at,
  in_time, out_time, site_id, site_name, day_value, is_leave
FROM public.attendance;

CREATE OR REPLACE VIEW public.material_receipts_view AS
SELECT
  id, receipt_number, po_id, project_id, supplier_id, receipt_date, photo_path, remarks,
  CASE WHEN public.is_finance_user() THEN total_amount ELSE 0 END AS total_amount,
  is_demo, created_by, created_at, updated_by, updated_at
FROM public.material_receipts;

CREATE OR REPLACE VIEW public.material_requests_view AS
SELECT
  id, request_number, project_id, request_date, required_date, status, photo_path, remarks,
  CASE WHEN public.is_finance_user() THEN total_amount ELSE 0 END AS total_amount,
  is_demo, created_by, created_at, updated_by, updated_at, material_name
FROM public.material_requests;
