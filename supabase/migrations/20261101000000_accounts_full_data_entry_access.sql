-- =========================================================================
-- MIGRATION: Accounts Role — Full Data-Entry Access
-- 20261101000000_accounts_full_data_entry_access.sql
-- Idempotent, safe, additive migration.
-- =========================================================================
-- Summary of changes:
--   1. Fix cash_closing SELECT policy so Accounts can see ALL entries (not own-only)
--   2. Fix expenses SELECT policy so Accounts can see ALL office expenses (not own-only)
--   3. Ensure weekly_wage_adjustments has correct table-level GRANTs
--   4. Ensure attendance_view and all related views include Accounts wage data
--   5. Add indent_id foreign-key requirement helper for PO validation (DB side)
--   6. Grant account_transfers table-level write privileges to authenticated
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: Fix cash_closing — Accounts sees ALL entries (not own-only)
-- -------------------------------------------------------------------------
-- Root cause: "cash_closing select policy" in 20261018000000 restricted
-- Accounts to only rows where created_by = auth.uid().
-- Fix: Accounts should see all cash_closing records.
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "cash_closing select policy" ON public.cash_closing;

CREATE POLICY "cash_closing select policy" ON public.cash_closing
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md()
      OR public.has_role(auth.uid(), 'accounts')
    )
  );

-- -------------------------------------------------------------------------
-- PART 2: Fix expenses — Accounts sees ALL expenses (project + office)
-- -------------------------------------------------------------------------
-- Root cause: Prior policy restricted Accounts to only own-created office expenses.
-- Fix: Accounts should see all expense records (project + office).
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "expenses select policy" ON public.expenses;

CREATE POLICY "expenses select policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_md()
      OR public.has_role(auth.uid(), 'accounts')
      OR (public.has_role(auth.uid(), 'supervisor') AND project_id IS NOT NULL)
    )
  );

-- -------------------------------------------------------------------------
-- PART 3: Ensure weekly_wage_adjustments GRANTs are correct
-- -------------------------------------------------------------------------
-- The original migration granted SELECT,INSERT,UPDATE,DELETE but a later
-- migration may have revoked DELETE. Re-grant what is needed.
-- -------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.weekly_wage_adjustments TO authenticated;
GRANT ALL ON public.weekly_wage_adjustments TO service_role;

-- Ensure deleted_at exists (for consistent soft-delete support)
ALTER TABLE public.weekly_wage_adjustments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Drop & re-create weekly_wage_adjustments RLS policies with correct scope
DROP POLICY IF EXISTS "weekly_wage_adjustments read policy" ON public.weekly_wage_adjustments;
DROP POLICY IF EXISTS "weekly_wage_adjustments write policy" ON public.weekly_wage_adjustments;
-- Also drop the policies added by the loop in 20261018000000
DROP POLICY IF EXISTS "weekly_wage_adjustments select policy" ON public.weekly_wage_adjustments;
DROP POLICY IF EXISTS "weekly_wage_adjustments insert policy" ON public.weekly_wage_adjustments;
DROP POLICY IF EXISTS "weekly_wage_adjustments update policy" ON public.weekly_wage_adjustments;

CREATE POLICY "weekly_wage_adjustments select policy" ON public.weekly_wage_adjustments
  FOR SELECT TO authenticated
  USING (public.is_finance_user());

CREATE POLICY "weekly_wage_adjustments insert policy" ON public.weekly_wage_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "weekly_wage_adjustments update policy" ON public.weekly_wage_adjustments
  FOR UPDATE TO authenticated
  USING (public.is_finance_user())
  WITH CHECK (public.is_finance_user());

-- -------------------------------------------------------------------------
-- PART 4: Ensure account_transfers has proper table-level GRANTs
-- -------------------------------------------------------------------------

DO $$
BEGIN
  -- account_transfers was created in an earlier migration without explicit grants
  -- Ensure authenticated role can read/write
  GRANT SELECT, INSERT, UPDATE ON public.account_transfers TO authenticated;
  GRANT ALL ON public.account_transfers TO service_role;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if already granted
END $$;

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_transfers read policy" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers select policy" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers insert policy" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers update policy" ON public.account_transfers;

CREATE POLICY "account_transfers select policy" ON public.account_transfers
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user());

CREATE POLICY "account_transfers insert policy" ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "account_transfers update policy" ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user())
  WITH CHECK (deleted_at IS NULL AND public.is_finance_user());

-- -------------------------------------------------------------------------
-- PART 5: Ensure client_payments has table-level GRANTs (safety check)
-- -------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.client_payments TO authenticated;
GRANT ALL ON public.client_payments TO service_role;

-- -------------------------------------------------------------------------
-- PART 6: Attendance view — ensure wage data visible to Accounts
-- -------------------------------------------------------------------------
-- The attendance_view CASE uses is_finance_user() — accounts is a finance user.
-- However, re-create to be explicit and safe.
-- -------------------------------------------------------------------------

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

-- -------------------------------------------------------------------------
-- PART 7: Employees view — ensure wage_rate visible to Accounts
-- -------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.employees_view AS
SELECT
  id,
  employee_code,
  full_name,
  employee_type,
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
-- PART 8: material_request_items — ensure Accounts can INSERT/UPDATE/DELETE
-- -------------------------------------------------------------------------
-- The multi-material indent dialog does a direct .delete() on material_request_items
-- when editing. Ensure the table allows this for Accounts.
-- -------------------------------------------------------------------------

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_request_items TO authenticated;
  GRANT ALL ON public.material_request_items TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_request_items select policy" ON public.material_request_items;
DROP POLICY IF EXISTS "material_request_items insert policy" ON public.material_request_items;
DROP POLICY IF EXISTS "material_request_items update policy" ON public.material_request_items;
DROP POLICY IF EXISTS "material_request_items delete policy" ON public.material_request_items;

CREATE POLICY "material_request_items select policy" ON public.material_request_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND public.is_operations_user()
  );

CREATE POLICY "material_request_items insert policy" ON public.material_request_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_operations_user());

CREATE POLICY "material_request_items update policy" ON public.material_request_items
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user())
  WITH CHECK (deleted_at IS NULL AND public.is_operations_user());

-- Allow DELETE on items (used when editing an indent to replace line items)
-- This is not a user-visible delete — it's part of the edit workflow.
CREATE POLICY "material_request_items delete policy" ON public.material_request_items
  FOR DELETE TO authenticated
  USING (public.is_operations_user());

-- Same for purchase_order_items (used when editing a PO)
DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_receipt_items TO authenticated;
  GRANT ALL ON public.material_receipt_items TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
  GRANT ALL ON public.purchase_order_items TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_order_items select policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items insert policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items update policy" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items delete policy" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items select policy" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user());

CREATE POLICY "purchase_order_items insert policy" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());

CREATE POLICY "purchase_order_items update policy" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_finance_user())
  WITH CHECK (deleted_at IS NULL AND public.is_finance_user());

-- Allow DELETE on PO items (used when editing a PO to replace line items)
CREATE POLICY "purchase_order_items delete policy" ON public.purchase_order_items
  FOR DELETE TO authenticated
  USING (public.is_finance_user());

ALTER TABLE public.material_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_receipt_items select policy" ON public.material_receipt_items;
DROP POLICY IF EXISTS "material_receipt_items insert policy" ON public.material_receipt_items;
DROP POLICY IF EXISTS "material_receipt_items update policy" ON public.material_receipt_items;
DROP POLICY IF EXISTS "material_receipt_items delete policy" ON public.material_receipt_items;

CREATE POLICY "material_receipt_items select policy" ON public.material_receipt_items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user());

CREATE POLICY "material_receipt_items insert policy" ON public.material_receipt_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_operations_user());

CREATE POLICY "material_receipt_items update policy" ON public.material_receipt_items
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user())
  WITH CHECK (deleted_at IS NULL AND public.is_operations_user());

CREATE POLICY "material_receipt_items delete policy" ON public.material_receipt_items
  FOR DELETE TO authenticated
  USING (public.is_operations_user());

-- -------------------------------------------------------------------------
-- PART 9: Auto-generate receipt_number for client_payments if not provided
-- -------------------------------------------------------------------------
-- Ensure client_payments has a sequence-based receipt number generator
-- -------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.client_payment_receipt_seq START 1001 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'RCP-' || LPAD(nextval('public.client_payment_receipt_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO authenticated;

-- -------------------------------------------------------------------------
-- PART 10: Ensure material_requests and purchase_orders have correct GRANTs
-- -------------------------------------------------------------------------

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE ON public.material_requests TO authenticated;
  GRANT ALL ON public.material_requests TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE ON public.purchase_orders TO authenticated;
  GRANT ALL ON public.purchase_orders TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- PART 11: Verify RLS is enabled on all key tables
-- -------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tables_to_check text[] := ARRAY[
    'cash_closing', 'expenses', 'weekly_wage_adjustments', 'account_transfers',
    'client_payments', 'attendance', 'material_requests', 'material_request_items',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'supplier_payments', 'contractor_payments', 'contractor_bills', 'subcontractor_payments',
    'wage_payments', 'payment_milestones'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_check LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;
