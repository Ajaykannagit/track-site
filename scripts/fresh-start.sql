-- =============================================================================
-- BRICKWELD TRACK-SITE: FRESH START SCRIPT (CLEAN BATCH DELETE)
-- =============================================================================
-- ⚠️  WARNING: PERMANENTLY DELETES TEST BUSINESS & TEST MASTER DATA.
--     PRESERVES: User logins, roles, permissions, settings, and expense categories.
-- =============================================================================

BEGIN;

-- 1. Child Allocations & Audit/Notification logs
DELETE FROM public.group_payment_allocations;
DELETE FROM public.purchase_order_items;
DELETE FROM public.material_receipt_items;
DELETE FROM public.material_request_items;
DELETE FROM public.payment_milestones;
DELETE FROM public.team_members;
DELETE FROM public.notifications;
DELETE FROM public.audit_logs;
DELETE FROM public.deletion_requests;

-- 2. Receipts & Bills
DELETE FROM public.material_receipts;
DELETE FROM public.contractor_bills;
DELETE FROM public.measurement_books;

-- 3. Payments & Adjustments
DELETE FROM public.supplier_payments;
DELETE FROM public.contractor_payments;
DELETE FROM public.subcontractor_payments;
DELETE FROM public.group_payments;
DELETE FROM public.labour_wage_payments;
DELETE FROM public.wage_payments;
DELETE FROM public.weekly_wage_adjustments;
DELETE FROM public.attendance;
DELETE FROM public.expenses;
DELETE FROM public.md_investments;
DELETE FROM public.client_payments;
DELETE FROM public.account_transfers;
DELETE FROM public.cash_closing;

-- 4. Orders & Requests
DELETE FROM public.purchase_orders;
DELETE FROM public.material_requests;
DELETE FROM public.work_orders;
DELETE FROM public.project_quotations;

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
