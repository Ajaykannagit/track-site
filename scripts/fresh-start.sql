-- =============================================================================
-- BRICKWELD TRACK-SITE: FRESH START SCRIPT
-- =============================================================================
-- ⚠️  WARNING: THIS SCRIPT PERMANENTLY DELETES ALL BUSINESS DATA.
-- ⚠️  It is IRREVERSIBLE. There is NO undo. Take a full database backup first.
--
-- PURPOSE:
--   Wipe all transactional data so the company can start live operations on a
--   clean slate. Preserves everything needed for the system to work:
--   - auth.users, user_roles, permissions (all logins intact)
--   - app_settings and system configuration
--   - expense_categories lookup table (including Advertisement & Marketing,
--     Commission, Loading, Bank Charges seeded in migration)
--   - job_types, sites (project lookup tables)
--   - account_opening_balances rows (reset to 0 by default — see below)
--   - machines (equipment master)
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

-- ============ 1. TRANSACTIONAL / FINANCIAL DATA ============
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

-- ============ 2. MATERIAL / PURCHASE DATA ============
TRUNCATE TABLE
  public.material_receipt_items,
  public.material_receipts,
  public.material_request_items,
  public.material_requests,
  public.purchase_order_items,
  public.purchase_orders,
  public.indents
CASCADE;

-- ============ 3. WORK / CONTRACT DATA ============
TRUNCATE TABLE
  public.measurement_books,
  public.contractor_bills,
  public.work_orders
CASCADE;

-- ============ 4. ATTENDANCE ============
TRUNCATE TABLE
  public.attendance
CASCADE;

-- ============ 5. PROJECT DATA (projects, quotations, milestones) ============
-- NOTE: Clients and contractors are preserved (master data).
-- Only project-level transactional records are deleted.
TRUNCATE TABLE
  public.payment_milestones,
  public.project_quotations,
  public.projects
CASCADE;

-- ============ 6. NOTIFICATIONS & AUDIT LOGS ============
TRUNCATE TABLE
  public.notifications,
  public.audit_logs,
  public.deletion_requests
CASCADE;

-- ============ 7. RESET OPENING BALANCES TO ZERO ============
-- (Optional: comment out if you want to keep existing opening balances)
UPDATE public.account_opening_balances
SET opening_balance = 0,
    as_of_date      = CURRENT_DATE,
    updated_at      = now()
WHERE account_type IN ('bank', 'petty_cash');

-- ============ 8. RESET SEQUENCES ============
-- Document number sequences — reset to start fresh
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

-- ============ PRESERVED (NOT deleted) ============
-- ✅ auth.users              — all user logins intact
-- ✅ user_roles              — all role assignments intact
-- ✅ app_settings            — all system settings intact
-- ✅ expense_categories      — all categories (including Advertisement & Marketing, Commission, Loading, Bank Charges)
-- ✅ job_types               — all job type lookup values
-- ✅ sites                   — all site records
-- ✅ machines                — all equipment master records
-- ✅ clients                 — all client master records
-- ✅ employees               — all employee records (with staff_type classification)
-- ✅ contractors             — all contractor master records
-- ✅ suppliers               — all supplier master records
-- ✅ teams                   — all team master records
-- ✅ account_opening_balances — rows kept, amounts reset to 0
-- ✅ permissions / role_permissions — all role-based access control

COMMIT;

-- ============ CONFIRMATION ============
DO $$
BEGIN
  RAISE NOTICE '==========================================================';
  RAISE NOTICE ' FRESH START COMPLETE.';
  RAISE NOTICE ' All transactional data has been permanently deleted.';
  RAISE NOTICE ' Users, roles, masters, and lookup tables are preserved.';
  RAISE NOTICE ' Opening balances have been reset to zero.';
  RAISE NOTICE '==========================================================';
END $$;
