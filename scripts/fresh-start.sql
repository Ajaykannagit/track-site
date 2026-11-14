-- =============================================================================
-- BRICKWELD TRACK-SITE: FRESH START SCRIPT (FULL WIPE)
-- =============================================================================
-- ⚠️  WARNING: THIS SCRIPT PERMANENTLY DELETES ALL BUSINESS & MASTER DATA.
-- ⚠️  It is IRREVERSIBLE. There is NO undo. Take a full database backup first.
--
-- PURPOSE:
--   Wipe ALL test/fake transactional data AND master data (clients, employees,
--   teams, team_members, contractors, suppliers, machines, job_types created as test data).
--   Preserves ONLY:
--   - Schema / Table structures
--   - auth.users, user_roles, user_permissions (all logins and credentials intact)
--   - app_settings and system configurations
--   - lookup lists: expense_categories (including 4 new ones), units, payment modes
--   - account_opening_balances table rows (reset to zero)
--
-- HOW TO RUN (run ONLY after all tests pass, as the VERY LAST step):
--   psql "$SUPABASE_DB_URL" -f scripts/fresh-start.sql \
--        -v confirm="I UNDERSTAND ALL DATA WILL BE DELETED"
--
-- DO NOT place this file in supabase/migrations/ — it must NEVER auto-run.
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

-- ============ BEGIN FRESH START ============
BEGIN;

-- ============ 1. TRANSACTIONAL & FINANCIAL DATA ============
TRUNCATE TABLE
  public.group_payment_allocations,
  public.group_payments,
  public.supplier_payments,
  public.contractor_payments,
  public.subcontractor_payments,
  public.client_payments,
  public.wage_payments,
  public.labour_wage_payments,
  public.weekly_wage_adjustments,
  public.expenses,
  public.md_investments,
  public.account_transfers,
  public.cash_closing
CASCADE;

-- ============ 2. MATERIAL & PURCHASE DATA ============
TRUNCATE TABLE
  public.material_receipt_items,
  public.material_receipts,
  public.material_request_items,
  public.material_requests,
  public.purchase_order_items,
  public.purchase_orders,
  public.indents
CASCADE;

-- ============ 3. WORK & CONTRACT DATA ============
TRUNCATE TABLE
  public.measurement_books,
  public.contractor_bills,
  public.work_orders
CASCADE;

-- ============ 4. ATTENDANCE ============
TRUNCATE TABLE
  public.attendance
CASCADE;

-- ============ 5. PROJECTS & MILESTONES ============
TRUNCATE TABLE
  public.payment_milestones,
  public.project_quotations,
  public.projects
CASCADE;

-- ============ 6. MASTER DATA (TEST DATA WIPED AS REQUESTED) ============
TRUNCATE TABLE
  public.team_members,
  public.teams,
  public.employees,
  public.contractors,
  public.suppliers,
  public.clients,
  public.machines,
  public.job_types
CASCADE;

-- ============ 7. NOTIFICATIONS, AUDIT LOGS, DELETION REQUESTS ============
TRUNCATE TABLE
  public.notifications,
  public.audit_logs,
  public.deletion_requests
CASCADE;

-- ============ 8. RESET OPENING BALANCES TO ZERO ============
UPDATE public.account_opening_balances
SET opening_balance = 0,
    as_of_date      = CURRENT_DATE,
    updated_at      = now()
WHERE account_type IN ('bank', 'petty_cash');

-- ============ 9. RESET NUMBERING SEQUENCES ============
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
      RAISE NOTICE 'Reset sequence: %', seq_name;
    EXCEPTION WHEN undefined_object THEN
      -- Sequence doesn't exist — skip silently
    END;
  END LOOP;
END $$;

-- ============ PRESERVED TABLES (NOT DELETED) ============
-- ✅ auth.users / auth identities   — user logins intact
-- ✅ user_roles / role_permissions  — MD, Accounts, Supervisor, Viewer roles intact
-- ✅ app_settings                   — company profile and config settings
-- ✅ expense_categories             — standard categories + 4 newly seeded categories
-- ✅ account_opening_balances rows  — bank & petty_cash rows preserved, balance reset to 0

COMMIT;

-- ============ CONFIRMATION ============
DO $$
BEGIN
  RAISE NOTICE '==========================================================';
  RAISE NOTICE ' FRESH START COMPLETE.';
  RAISE NOTICE ' All transactional data and master data wiped clean.';
  RAISE NOTICE ' Users, roles, permissions, settings & lookup lists preserved.';
  RAISE NOTICE ' Bank and Petty Cash opening balances reset to 0.00.';
  RAISE NOTICE '==========================================================';
END $$;
