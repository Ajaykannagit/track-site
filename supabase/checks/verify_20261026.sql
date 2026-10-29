-- =========================================================================
-- BRICKWELD VERIFICATION SCRIPT FOR MIGRATION 20261026000000
-- Run this in the Supabase SQL Editor after applying the migration
-- to confirm all security fixes, policies, and functions are intact.
-- =========================================================================

-- 1. Check handle_new_user definition enforces viewer role:
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';
-- Expected: The source contains 'viewer'::public.app_role and does NOT read role from raw_user_meta_data.

-- 2. Verify DELETE privilege is REVOKED on domain tables for authenticated role:
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND privilege_type = 'DELETE'
  AND table_name IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'material_receipts', 'material_requests', 'project_quotations',
    'client_payments', 'clients', 'employees', 'contractors', 'suppliers'
  );
-- Expected: 0 rows returned (no DELETE privilege granted to authenticated).

-- 3. Confirm can_write_attendance includes 'accounts':
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'can_write_attendance';
-- Expected: prosrc checks 'md', 'supervisor', AND 'accounts'.

-- 4. Check soft_delete_record whitelist:
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'soft_delete_record';
-- Expected: Whitelist includes clients, employees, contractors, suppliers, machines, projects, work_orders, etc.

-- 5. Confirm audit_logs policies:
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'audit_logs';
-- Expected:
-- "audit read": FOR SELECT, USING (public.is_md())
-- "audit insert": FOR INSERT, WITH CHECK (performed_by = auth.uid() OR auth.uid() IS NULL)

-- 6. Confirm deletion_requests policies:
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'deletion_requests';
-- Expected:
-- SELECT allowed for MD or requester (requested_by = auth.uid())
-- INSERT with CHECK requested_by = auth.uid()
-- UPDATE and DELETE for MD only

-- 7. Confirm notification_reads table exists with RLS:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notification_reads';
-- Expected: rowsecurity = true.

-- 8. Verify get_row_markers function exists and is executable:
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_row_markers';
-- Expected: prosecdef = true (SECURITY DEFINER).

-- 9. Verify can_manage_masters function and master tables INSERT/UPDATE policies for Accounts & MD:
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'can_manage_masters';
-- Expected: prosrc checks 'md' OR 'accounts'.

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('clients', 'projects', 'employees', 'contractors', 'suppliers')
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY tablename, cmd;
-- Expected: <table_name> insert policy and <table_name> update policy present on all 5 tables.
