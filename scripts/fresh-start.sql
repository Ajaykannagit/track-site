-- =============================================================================
-- BRICKWELD TRACK-SITE: FRESH START SCRIPT (SAFE ORDERED DELETE)
-- =============================================================================
-- ⚠️  WARNING: THIS SCRIPT PERMANENTLY DELETES ALL BUSINESS & MASTER DATA.
-- ⚠️  It is IRREVERSIBLE. There is NO undo. Take a full database backup first.
--
-- PURPOSE:
--   Wipe ALL test/fake transactional data AND master data (clients, employees,
--   teams, team_members, contractors, suppliers, machines, job_types).
--
-- SAFETY ASSURANCE:
--   - Does NOT use TRUNCATE ... CASCADE (which could cascade to unlisted tables).
--   - Uses explicit DELETE in strict foreign-key dependency order (children first).
--   - Preserves ONLY:
--     * auth schema (auth.users, identities, sessions) - 100% untouched
--     * user_roles & role_permissions (logins and RBAC intact)
--     * app_settings (company configurations)
--     * expense_categories (including 4 new seeded categories)
--     * account_opening_balances rows (reset to zero)
--
-- HOW TO RUN:
--   psql "$SUPABASE_DB_URL" -f scripts/fresh-start.sql \
--        -v confirm="I UNDERSTAND ALL DATA WILL BE DELETED"
-- =============================================================================

-- ============ SAFETY GATE ============
DO $$
BEGIN
  IF current_setting('vars.confirm', true) IS DISTINCT FROM 'I UNDERSTAND ALL DATA WILL BE DELETED' THEN
    RAISE EXCEPTION
      E'\n\n'
      '============================================================\n'
      ' FRESH-START ABORTED — Confirmation parameter not provided.\n'
      ' Re-run with: -v confirm="I UNDERSTAND ALL DATA WILL BE DELETED"\n'
      '============================================================\n';
  END IF;
END $$;

-- ============ BEGIN TRANSACTION ============
BEGIN;

-- 1. Child Allocations & Audit/Notification logs (depend on parents)
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
DELETE FROM public.indents;
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

-- 8. Reset Numbering Sequences
DO $$
DECLARE
  seq_name text;
  seq_list text[] := ARRAY[
    'group_payment_number_seq',
    'po_number_seq',
    'purchase_order_number_seq',
    'grn_number_seq',
    'indent_number_seq',
    'work_order_number_seq',
    'bill_number_seq',
    'receipt_number_seq',
    'payment_number_seq'
  ];
BEGIN
  FOREACH seq_name IN ARRAY seq_list LOOP
    BEGIN
      EXECUTE format('ALTER SEQUENCE IF EXISTS public.%I RESTART WITH 1;', seq_name);
    EXCEPTION WHEN undefined_object THEN
      -- Sequence doesn't exist — skip
    END;
  END LOOP;
END $$;

-- ============ PRESERVED (NOT deleted) ============
-- ✅ auth.users / identities / sessions  — completely untouched
-- ✅ user_roles / role_permissions       — user roles intact
-- ✅ app_settings                        — system configuration intact
-- ✅ expense_categories                  — seeded categories intact
-- ✅ account_opening_balances rows       — rows preserved, balances reset to 0

COMMIT;
