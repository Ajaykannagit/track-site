-- =========================================================================
-- MIGRATION: 20261105000000_group_payments_and_team_history.sql
-- PURPOSE:
--   1. Create job_types master table and add job_type_id to work_orders.
--   2. Create group_payments and group_payment_allocations tables.
--   3. Create team_members table for historical membership tracking and backfill.
--   4. Add atomic RPC functions for creating, editing, and voiding group payments.
--   5. Add RLS policies and indexes.
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: Job Types Master & Work Orders Job Type
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_types' AND policyname = 'job_types_select_policy'
  ) THEN
    CREATE POLICY "job_types_select_policy" ON public.job_types
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_types' AND policyname = 'job_types_write_policy'
  ) THEN
    CREATE POLICY "job_types_write_policy" ON public.job_types
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS job_type_id uuid REFERENCES public.job_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_job_type_id ON public.work_orders(job_type_id);

-- -------------------------------------------------------------------------
-- PART 2: Group Payments & Allocations
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  payment_type text NOT NULL CHECK (payment_type IN ('contractor', 'supplier')),
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
  payment_mode text NOT NULL DEFAULT 'Bank',
  reference_number text,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  remarks text,
  is_void boolean NOT NULL DEFAULT false,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.group_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_payments' AND policyname = 'group_payments_select_policy'
  ) THEN
    CREATE POLICY "group_payments_select_policy" ON public.group_payments
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_payments' AND policyname = 'group_payments_write_policy'
  ) THEN
    CREATE POLICY "group_payments_write_policy" ON public.group_payments
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_group_payments_contractor ON public.group_payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_group_payments_supplier ON public.group_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_group_payments_date ON public.group_payments(payment_date);

-- Allocation Rows
CREATE TABLE IF NOT EXISTS public.group_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_payment_id uuid NOT NULL REFERENCES public.group_payments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  contractor_bill_id uuid REFERENCES public.contractor_bills(id) ON DELETE RESTRICT,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  remarks text,
  is_void boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_payment_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_payment_allocations' AND policyname = 'group_alloc_select_policy'
  ) THEN
    CREATE POLICY "group_alloc_select_policy" ON public.group_payment_allocations
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_payment_allocations' AND policyname = 'group_alloc_write_policy'
  ) THEN
    CREATE POLICY "group_alloc_write_policy" ON public.group_payment_allocations
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alloc_group_payment ON public.group_payment_allocations(group_payment_id);
CREATE INDEX IF NOT EXISTS idx_alloc_project ON public.group_payment_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_alloc_work_order ON public.group_payment_allocations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_alloc_po ON public.group_payment_allocations(po_id);

-- Also add group_payment_id link column to existing payment tables for complete audit & cross-referencing
ALTER TABLE public.contractor_payments ADD COLUMN IF NOT EXISTS group_payment_id uuid REFERENCES public.group_payments(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS group_payment_id uuid REFERENCES public.group_payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_payments_group ON public.contractor_payments(group_payment_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_group ON public.supplier_payments(group_payment_id);

-- -------------------------------------------------------------------------
-- PART 3: Team Members History & Carry-Over
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  left_on date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT check_dates CHECK (left_on IS NULL OR left_on >= effective_from)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_select_policy'
  ) THEN
    CREATE POLICY "team_members_select_policy" ON public.team_members
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'team_members_write_policy'
  ) THEN
    CREATE POLICY "team_members_write_policy" ON public.team_members
      FOR ALL TO authenticated
      USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_emp ON public.team_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_team_members_dates ON public.team_members(effective_from, left_on);

-- Backfill from current employees.team_id (idempotent)
INSERT INTO public.team_members (team_id, employee_id, effective_from, is_active)
SELECT 
  e.team_id, 
  e.id, 
  COALESCE(e.joining_date, '2026-01-01'::date),
  COALESCE(e.status = 'active', true)
FROM public.employees e
WHERE e.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = e.team_id AND tm.employee_id = e.id
  );

GRANT SELECT, INSERT, UPDATE ON public.job_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.group_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.group_payment_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_members TO authenticated;

-- -------------------------------------------------------------------------
-- PART 4: RPC for Atomic Group Payment Creation
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_group_payment(
  p_payment_type text,
  p_party_id uuid, -- contractor_id or supplier_id
  p_payment_date date,
  p_total_amount numeric,
  p_payment_mode text,
  p_reference_number text,
  p_bank_account_id uuid,
  p_remarks text,
  p_allocations jsonb -- array of { project_id, work_order_id, contractor_bill_id, po_id, allocated_amount, remarks }
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean;
  v_group_id uuid;
  v_payment_number text;
  v_seq integer;
  v_sum_alloc numeric := 0;
  v_alloc record;
  v_party_name text;
BEGIN
  -- 1. Authorization: MD or Accounts
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Accounts or MD can record group payments.';
  END IF;

  -- 2. Validate input
  IF p_payment_type NOT IN ('contractor', 'supplier') THEN
    RAISE EXCEPTION 'Invalid payment type: %', p_payment_type;
  END IF;

  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero.';
  END IF;

  IF jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one allocation item is required.';
  END IF;

  -- 3. Calculate sum of allocations and validate
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS (
    project_id uuid,
    work_order_id uuid,
    contractor_bill_id uuid,
    po_id uuid,
    allocated_amount numeric,
    remarks text
  ) LOOP
    IF v_alloc.allocated_amount <= 0 THEN
      RAISE EXCEPTION 'Each allocated amount must be positive.';
    END IF;
    v_sum_alloc := v_sum_alloc + v_alloc.allocated_amount;
  END LOOP;

  IF abs(v_sum_alloc - p_total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Sum of allocations (%) does not equal total payment amount (%).', v_sum_alloc, p_total_amount;
  END IF;

  -- 4. Generate sequential payment number: GP-YYYYMM-XXXX
  SELECT count(*) + 1 INTO v_seq FROM public.group_payments;
  v_payment_number := 'GP-' || to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  -- 5. Insert Parent Group Payment
  INSERT INTO public.group_payments (
    payment_number,
    payment_type,
    contractor_id,
    supplier_id,
    payment_date,
    total_amount,
    payment_mode,
    reference_number,
    bank_account_id,
    remarks,
    created_by
  ) VALUES (
    v_payment_number,
    p_payment_type,
    CASE WHEN p_payment_type = 'contractor' THEN p_party_id ELSE NULL END,
    CASE WHEN p_payment_type = 'supplier' THEN p_party_id ELSE NULL END,
    p_payment_date,
    p_total_amount,
    p_payment_mode,
    p_reference_number,
    p_bank_account_id,
    p_remarks,
    v_user_id
  ) RETURNING id INTO v_group_id;

  -- 6. Insert Allocations & Corresponding Child Payment records for each project
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS (
    project_id uuid,
    work_order_id uuid,
    contractor_bill_id uuid,
    po_id uuid,
    allocated_amount numeric,
    remarks text
  ) LOOP
    -- Insert allocation record
    INSERT INTO public.group_payment_allocations (
      group_payment_id,
      project_id,
      work_order_id,
      contractor_bill_id,
      po_id,
      allocated_amount,
      remarks
    ) VALUES (
      v_group_id,
      v_alloc.project_id,
      v_alloc.work_order_id,
      v_alloc.contractor_bill_id,
      v_alloc.po_id,
      v_alloc.allocated_amount,
      v_alloc.remarks
    );

    -- Insert into individual project payment tables so project cost tabs immediately reflect it
    IF p_payment_type = 'contractor' THEN
      INSERT INTO public.contractor_payments (
        group_payment_id,
        project_id,
        contractor_id,
        bill_id,
        payment_date,
        amount,
        payment_mode,
        reference_number,
        bank_account_id,
        remarks,
        created_by
      ) VALUES (
        v_group_id,
        v_alloc.project_id,
        p_party_id,
        v_alloc.contractor_bill_id,
        p_payment_date,
        v_alloc.allocated_amount,
        p_payment_mode,
        COALESCE(p_reference_number, v_payment_number),
        p_bank_account_id,
        COALESCE(v_alloc.remarks, p_remarks, 'Group payment ' || v_payment_number),
        v_user_id
      );
    ELSE
      INSERT INTO public.supplier_payments (
        group_payment_id,
        project_id,
        supplier_id,
        po_id,
        payment_date,
        amount,
        payment_mode,
        reference_number,
        bank_account_id,
        remarks,
        created_by
      ) VALUES (
        v_group_id,
        v_alloc.project_id,
        p_party_id,
        v_alloc.po_id,
        p_payment_date,
        v_alloc.allocated_amount,
        p_payment_mode,
        COALESCE(p_reference_number, v_payment_number),
        p_bank_account_id,
        COALESCE(v_alloc.remarks, p_remarks, 'Group payment ' || v_payment_number),
        v_user_id
      );
    END IF;
  END LOOP;

  -- 7. Audit Log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    module,
    user_role,
    performed_by,
    performed_at,
    details
  ) VALUES (
    'group_payments',
    v_group_id,
    'create',
    CASE WHEN p_payment_type = 'contractor' THEN 'contractors' ELSE 'materials' END,
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    v_user_id,
    now(),
    jsonb_build_object(
      'payment_number', v_payment_number,
      'total_amount', p_total_amount,
      'payment_type', p_payment_type,
      'allocations_count', jsonb_array_length(p_allocations)
    )
  );

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_payment(text, uuid, date, numeric, text, text, uuid, text, jsonb) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 5: RPC for Voiding / Unvoiding Group Payment (Atomic across all splits)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_group_payment(
  p_group_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean;
BEGIN
  -- 1. Authorization
  SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Accounts or MD can void group payments.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A mandatory reason is required to void this group payment.';
  END IF;

  -- 2. Mark parent as void
  UPDATE public.group_payments 
  SET is_void = true, voided_at = now(), voided_by = v_user_id, void_reason = trim(p_reason)
  WHERE id = p_group_id AND is_void = false;

  -- 3. Mark allocations as void
  UPDATE public.group_payment_allocations
  SET is_void = true
  WHERE group_payment_id = p_group_id;

  -- 4. Mark child contractor_payments & supplier_payments as void
  UPDATE public.contractor_payments
  SET is_void = true, voided_at = now(), voided_by = v_user_id, void_reason = trim(p_reason)
  WHERE group_payment_id = p_group_id;

  UPDATE public.supplier_payments
  SET is_void = true, voided_at = now(), voided_by = v_user_id, void_reason = trim(p_reason)
  WHERE group_payment_id = p_group_id;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, field_name,
    old_value, new_value, reason, user_role, performed_by, performed_at, details
  ) VALUES (
    'group_payments',
    p_group_id,
    'update',
    'accounts',
    'is_void',
    'false',
    'true',
    p_reason,
    CASE WHEN public.is_md() THEN 'md' ELSE 'accounts' END,
    v_user_id,
    now(),
    jsonb_build_object('void_group_payment', true, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_group_payment(uuid, text) TO authenticated;
