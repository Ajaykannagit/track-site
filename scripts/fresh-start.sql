-- =============================================================================
-- BRICKWELD TRACK-SITE: COMPREHENSIVE DATA WIPE & MASTER RESET SCRIPT
-- =============================================================================
-- ⚠️  WARNING: PERMANENTLY CLEARS ALL BUSINESS TRANSACTIONS & TEST MASTER DATA.
--     ABORTS IMMEDIATELY if any public table is unclassified (neither WIPED nor KEPT).
--     PRESERVES: Auth users, user roles, system settings, permissions, and expense categories.
-- =============================================================================

DO $$
DECLARE
  v_unclassified text[];
  v_known_wiped text[] := ARRAY[
    'group_payment_allocations',
    'purchase_order_items',
    'material_receipt_items',
    'material_request_items',
    'payment_milestones',
    'team_members',
    'notifications',
    'notification_reads',
    'audit_logs',
    'deletion_requests',
    'material_receipts',
    'contractor_bills',
    'measurement_books',
    'measurement_items',
    'supplier_payments',
    'contractor_payments',
    'subcontractor_payments',
    'group_payments',
    'labour_wage_payments',
    'wage_payments',
    'weekly_wage_adjustments',
    'attendance',
    'expenses',
    'md_investments',
    'client_payments',
    'account_transfers',
    'cash_closing',
    'purchase_orders',
    'material_requests',
    'work_orders',
    'project_quotations',
    'project_documents',
    'project_budgets',
    'project_assignments',
    'projects',
    'teams',
    'employees',
    'contractors',
    'suppliers',
    'clients',
    'machines',
    'machine_movements',
    'job_types',
    'payroll',
    'payroll_items',
    'sites'
  ];
  v_known_kept text[] := ARRAY[
    'account_opening_balances',
    'expense_categories',
    'user_roles',
    'profiles',
    'app_settings',
    'schema_migrations'
  ];
BEGIN
  -- Verify all public tables are classified
  SELECT array_agg(table_name::text)
  INTO v_unclassified
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations'
    AND table_name != 'schema_migrations'
    AND NOT (table_name = ANY(v_known_wiped))
    AND NOT (table_name = ANY(v_known_kept));

  IF v_unclassified IS NOT NULL AND array_length(v_unclassified, 1) > 0 THEN
    RAISE EXCEPTION 'ABORTING WIPE: Found unclassified tables in public schema: %', v_unclassified;
  END IF;

  RAISE NOTICE 'SUCCESS: All public tables verified and accounted for. Proceeding with safe wipe...';
END $$;

BEGIN;

-- 1. Child Allocations & Audit/Notification logs
DELETE FROM public.group_payment_allocations;
DELETE FROM public.purchase_order_items;
DELETE FROM public.material_receipt_items;
DELETE FROM public.material_request_items;
DELETE FROM public.measurement_items;
DELETE FROM public.payment_milestones;
DELETE FROM public.team_members;
DELETE FROM public.notification_reads;
DELETE FROM public.notifications;
DELETE FROM public.audit_logs;
DELETE FROM public.deletion_requests;

-- 2. Receipts, Bills & Measurement Books
DELETE FROM public.material_receipts;
DELETE FROM public.contractor_bills;
DELETE FROM public.measurement_books;

-- 3. Payments, Wages & Financial Transactions
DELETE FROM public.supplier_payments;
DELETE FROM public.contractor_payments;
DELETE FROM public.subcontractor_payments;
DELETE FROM public.group_payments;
DELETE FROM public.labour_wage_payments;
DELETE FROM public.wage_payments;
DELETE FROM public.weekly_wage_adjustments;
DELETE FROM public.payroll_items;
DELETE FROM public.payroll;
DELETE FROM public.attendance;
DELETE FROM public.expenses;
DELETE FROM public.md_investments;
DELETE FROM public.client_payments;
DELETE FROM public.account_transfers;
DELETE FROM public.cash_closing;

-- 4. Orders, Requests & Quotations
DELETE FROM public.purchase_orders;
DELETE FROM public.material_requests;
DELETE FROM public.work_orders;
DELETE FROM public.project_quotations;
DELETE FROM public.project_documents;
DELETE FROM public.project_budgets;
DELETE FROM public.project_assignments;
DELETE FROM public.machine_movements;

-- 5. Projects
DELETE FROM public.projects;

-- 6. Masters (Fake / Test Master Data)
DELETE FROM public.teams;
DELETE FROM public.employees;
DELETE FROM public.contractors;
DELETE FROM public.suppliers;
DELETE FROM public.clients;
DELETE FROM public.machines;
DELETE FROM public.job_types;
DELETE FROM public.sites;

-- 7. Reset Opening Balances to 0.00
UPDATE public.account_opening_balances
SET opening_balance = 0,
    as_of_date      = CURRENT_DATE,
    updated_at      = now()
WHERE account_type IN ('bank', 'petty_cash');

COMMIT;

-- 8. Reset Numbering Sequences (outside transaction block)
ALTER SEQUENCE IF EXISTS public.group_payment_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.po_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.purchase_order_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.grn_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.indent_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.work_order_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.bill_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.receipt_number_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.payment_number_seq RESTART WITH 1;
