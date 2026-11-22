-- =========================================================================
-- LIVE DATABASE COMPREHENSIVE HEALTH CHECK & OBJECT INVENTORY
-- Run this in Supabase SQL Editor. It is 100% READ-ONLY.
-- =========================================================================

-- 1. Check Table Existence
WITH expected_tables(tbl) AS (
  VALUES
    ('account_opening_balances'),
    ('account_transfers'),
    ('app_settings'),
    ('attendance'),
    ('audit_logs'),
    ('cash_closing'),
    ('client_payments'),
    ('clients'),
    ('contractor_bills'),
    ('contractor_payments'),
    ('contractors'),
    ('employees'),
    ('expense_categories'),
    ('expenses'),
    ('group_payment_allocations'),
    ('group_payments'),
    ('job_types'),
    ('labour_wage_payments'),
    ('machines'),
    ('material_receipt_items'),
    ('material_receipts'),
    ('material_request_items'),
    ('material_requests'),
    ('md_investments'),
    ('measurement_books'),
    ('notifications'),
    ('payment_milestones'),
    ('profiles'),
    ('project_budgets'),
    ('project_quotations'),
    ('projects'),
    ('purchase_order_items'),
    ('purchase_orders'),
    ('sites'),
    ('subcontractor_payments'),
    ('supplier_payments'),
    ('suppliers'),
    ('team_members'),
    ('teams'),
    ('user_roles'),
    ('wage_payments'),
    ('weekly_wage_adjustments'),
    ('work_orders')
)
SELECT 
  e.tbl AS expected_table,
  CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING ❌' END AS table_status
FROM expected_tables e
LEFT JOIN information_schema.tables t 
  ON t.table_schema = 'public' AND t.table_name = e.tbl
ORDER BY table_status DESC, expected_table;

-- 2. Check View Existence
WITH expected_views(vw) AS (
  VALUES
    ('attendance_view'),
    ('employees_view'),
    ('material_receipts_view'),
    ('material_requests_view'),
    ('projects_view')
)
SELECT 
  e.vw AS expected_view,
  CASE WHEN v.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING ❌' END AS view_status
FROM expected_views e
LEFT JOIN information_schema.views v 
  ON v.table_schema = 'public' AND v.table_name = e.vw
ORDER BY view_status DESC, expected_view;

-- 3. Check Stored Procedures / RPC Functions Existence & Permissions
WITH expected_rpcs(fn) AS (
  VALUES
    ('approve_deletion_request'),
    ('create_group_payment'),
    ('get_account_balances'),
    ('get_row_markers'),
    ('record_audit_log'),
    ('reject_deletion_request'),
    ('restore_record'),
    ('soft_delete_record'),
    ('unvoid_record'),
    ('void_group_payment'),
    ('void_record')
)
SELECT 
  e.fn AS expected_rpc,
  CASE WHEN p.proname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING ❌' END AS rpc_status,
  pg_get_function_identity_arguments(p.oid) AS signature,
  CASE 
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED TO AUTHENTICATED'
    ELSE 'NO EXECUTE GRANT ❌'
  END AS execute_privilege
FROM expected_rpcs e
LEFT JOIN pg_proc p 
  ON p.pronamespace = 'public'::regnamespace AND p.proname = e.fn
ORDER BY rpc_status DESC, expected_rpc;

-- 4. Check Sequence Existence
WITH expected_seqs(sq) AS (
  VALUES
    ('group_payment_number_seq'),
    ('client_payment_receipt_seq')
)
SELECT 
  e.sq AS expected_sequence,
  CASE WHEN s.relname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING ❌' END AS sequence_status
FROM expected_seqs e
LEFT JOIN pg_class s 
  ON s.relnamespace = 'public'::regnamespace AND s.relkind = 'S' AND s.relname = e.sq;

-- 5. Check Critical Columns (is_void, deleted_at, payment_source, payment_mode)
SELECT 
  c.table_name,
  bool_or(c.column_name = 'deleted_at') AS has_deleted_at,
  bool_or(c.column_name = 'is_void') AS has_is_void,
  bool_or(c.column_name = 'payment_source') AS has_payment_source,
  bool_or(c.column_name = 'payment_mode') AS has_payment_mode
FROM information_schema.columns c
WHERE c.table_schema = 'public' 
  AND c.table_name IN (
    'expenses', 'client_payments', 'supplier_payments', 'contractor_payments', 
    'subcontractor_payments', 'contractor_bills', 'purchase_orders', 
    'material_requests', 'account_transfers', 'cash_closing', 'group_payments',
    'work_orders', 'measurement_books', 'labour_wage_payments', 'md_investments'
  )
GROUP BY c.table_name
ORDER BY c.table_name;
