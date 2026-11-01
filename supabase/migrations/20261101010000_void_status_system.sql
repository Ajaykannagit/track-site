-- =========================================================================
-- MIGRATION: 20261101010000_void_status_system.sql
-- PURPOSE:
--   1. Add voiding support (is_void, voided_at, voided_by, void_reason)
--      to core transactional tables:
--      - material_requests
--      - purchase_orders
--      - expenses
--      - client_payments
--      - supplier_payments
--      - contractor_bills
--      - contractor_payments
--      - subcontractor_payments
--      - account_transfers
--      - cash_closing
--   2. Add stored procedures:
--      - void_record (accessible to Accounts and MD, records audit log)
--      - unvoid_record (strictly MD-only, records audit log)
--   3. Update views to reflect is_void, voided_at, voided_by, void_reason
--   4. Ensure idempotent and safe for existing data (defaults is_void = false)
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: Add Void tracking columns to transactional tables
-- -------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'material_requests',
    'purchase_orders',
    'expenses',
    'client_payments',
    'supplier_payments',
    'contractor_bills',
    'contractor_payments',
    'subcontractor_payments',
    'account_transfers',
    'cash_closing'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Add is_void boolean column (default false)
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_void boolean NOT NULL DEFAULT false;', tbl);
    -- Add voided_at timestamp
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS voided_at timestamptz;', tbl);
    -- Add voided_by user ID
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;', tbl);
    -- Add void_reason text
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS void_reason text;', tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PART 2: Stored Procedure to Void a Record (Accounts & MD allowed)
-- Includes validation: A PO cannot be voided if active GRN or payments exist
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean;
  v_grn_count integer := 0;
  v_pay_count integer := 0;
  v_sql text;
BEGIN
  -- 1. Authorization: Only MD or Accounts role can void
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Accounts or MD can mark records as void.';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A mandatory reason is required to void this record.';
  END IF;

  -- 3. Whitelist allowed tables
  IF p_table_name NOT IN (
    'material_requests', 'purchase_orders', 'expenses', 'client_payments',
    'supplier_payments', 'contractor_bills', 'contractor_payments',
    'subcontractor_payments', 'account_transfers', 'cash_closing'
  ) THEN
    RAISE EXCEPTION 'Table % does not support voiding.', p_table_name;
  END IF;

  -- 4. Specific Business Rule: PO cannot be voided if active GRN or payments exist
  IF p_table_name = 'purchase_orders' THEN
    SELECT count(*) INTO v_grn_count
    FROM public.material_receipts
    WHERE po_id = p_record_id AND deleted_at IS NULL;

    IF v_grn_count > 0 THEN
      RAISE EXCEPTION 'Cannot void this Purchase Order because % Goods Receipt Note(s) are linked to it. Please void or delete the receipts first.', v_grn_count;
    END IF;

    SELECT count(*) INTO v_pay_count
    FROM public.supplier_payments
    WHERE po_id = p_record_id AND deleted_at IS NULL AND is_void = false;

    IF v_pay_count > 0 THEN
      RAISE EXCEPTION 'Cannot void this Purchase Order because % active supplier payment(s) are linked to it. Please void the payments first.', v_pay_count;
    END IF;
  END IF;

  -- 5. Mark as void
  v_sql := format(
    'UPDATE public.%I SET is_void = true, voided_at = now(), voided_by = %L, void_reason = %L WHERE id = %L AND deleted_at IS NULL',
    p_table_name, v_user_id, trim(p_reason), p_record_id
  );
  EXECUTE v_sql;

  -- 6. Log in Audit Trail
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    module,
    field_name,
    old_value,
    new_value,
    reason,
    user_role,
    performed_by,
    performed_at,
    details
  ) VALUES (
    p_table_name,
    p_record_id,
    'update',
    CASE
      WHEN p_table_name IN ('material_requests', 'purchase_orders') THEN 'materials'
      WHEN p_table_name IN ('expenses') THEN 'expenses'
      WHEN p_table_name IN ('contractor_bills', 'contractor_payments') THEN 'contractors'
      ELSE 'accounts'
    END,
    'is_void',
    'false',
    'true',
    p_reason,
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    v_user_id,
    now(),
    jsonb_build_object('void_action', true, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_record(text, uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 3: Stored Procedure to Unvoid (Strictly MD Only)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unvoid_record(
  p_table_name text,
  p_record_id uuid,
  p_reason text
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
  -- Strict validation: Only MD can reverse a void
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) can restore voided records.';
  END IF;

  IF p_table_name NOT IN (
    'material_requests', 'purchase_orders', 'expenses', 'client_payments',
    'supplier_payments', 'contractor_bills', 'contractor_payments',
    'subcontractor_payments', 'account_transfers', 'cash_closing'
  ) THEN
    RAISE EXCEPTION 'Table % does not support unvoiding.', p_table_name;
  END IF;

  v_sql := format(
    'UPDATE public.%I SET is_void = false, voided_at = NULL, voided_by = NULL, void_reason = NULL WHERE id = %L AND deleted_at IS NULL',
    p_table_name, p_record_id
  );
  EXECUTE v_sql;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    module,
    field_name,
    old_value,
    new_value,
    reason,
    user_role,
    performed_by,
    performed_at,
    details
  ) VALUES (
    p_table_name,
    p_record_id,
    'update',
    CASE
      WHEN p_table_name IN ('material_requests', 'purchase_orders') THEN 'materials'
      WHEN p_table_name IN ('expenses') THEN 'expenses'
      WHEN p_table_name IN ('contractor_bills', 'contractor_payments') THEN 'contractors'
      ELSE 'accounts'
    END,
    'is_void',
    'true',
    'false',
    p_reason,
    'md',
    v_user_id,
    now(),
    jsonb_build_object('unvoid_action', true, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unvoid_record(text, uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 4: Update Views to include is_void and void metadata
-- -------------------------------------------------------------------------

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
    WHEN public.is_finance_user() OR public.has_role(auth.uid(), 'accounts') THEN total_amount
    ELSE 0
  END AS total_amount,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at,
  material_name,
  is_void,
  voided_at,
  voided_by,
  void_reason
FROM public.material_requests
WHERE deleted_at IS NULL;

GRANT SELECT ON public.material_requests_view TO authenticated;
