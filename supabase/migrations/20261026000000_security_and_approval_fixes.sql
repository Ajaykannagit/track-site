-- =========================================================================
-- BRICKWELD TRACK-SITE: SECURITY, DELETION APPROVAL & ROW AUDIT FIXES
-- Migration: 20261026000000_security_and_approval_fixes.sql
-- Idempotent, safe migration using IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS
-- =========================================================================

-- Note on First MD User Creation:
-- The trigger handle_new_user() now always creates new accounts with the 'viewer' role.
-- Any client-supplied metadata role is strictly ignored to prevent privilege escalation.
-- The very first Managing Director (MD) user must be provisioned manually by executing:
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES ('<SUPABASE_AUTH_USER_UUID>', 'md')
--   ON CONFLICT (user_id, role) DO NOTHING;
-- in the Supabase SQL Editor.

-- -------------------------------------------------------------------------
-- PART 1: Strict User Creation Trigger (Ignore client metadata roles)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

  -- Always assign role 'viewer'. Metadata role is intentionally ignored.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- PART 2: Soft-Delete Whitelist & Column Expansions
-- -------------------------------------------------------------------------

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.measurement_books ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.account_transfers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Update soft_delete_record to whitelist expanded tables
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid
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
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) can delete records.';
  END IF;

  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments',
    'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
    'work_orders', 'measurement_books', 'account_transfers'
  ) THEN
    RAISE EXCEPTION 'Table % does not support soft delete.', p_table_name;
  END IF;

  -- 1. Soft delete the main record
  v_sql := format('UPDATE public.%I SET deleted_at = now() WHERE id = %L AND deleted_at IS NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  -- 2. Cascade soft delete to child line items if applicable
  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = now() WHERE po_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = now() WHERE receipt_id = p_record_id AND deleted_at IS NULL;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = now() WHERE request_id = p_record_id AND deleted_at IS NULL;
  END IF;

  -- 3. Audit log
  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'soft_delete', p_table_name, v_user_id, now(), 'md',
    jsonb_build_object('soft_deleted', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;

-- Update restore_record to whitelist expanded tables
CREATE OR REPLACE FUNCTION public.restore_record(
  p_table_name text,
  p_record_id uuid
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
  SELECT public.is_md() INTO v_is_md;
  IF NOT COALESCE(v_is_md, false) THEN
    RAISE EXCEPTION 'Permission denied. Only Managing Director (MD) can restore records.';
  END IF;

  IF p_table_name NOT IN (
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments',
    'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
    'work_orders', 'measurement_books', 'account_transfers'
  ) THEN
    RAISE EXCEPTION 'Table % does not support record restore.', p_table_name;
  END IF;

  v_sql := format('UPDATE public.%I SET deleted_at = NULL WHERE id = %L AND deleted_at IS NOT NULL', p_table_name, p_record_id);
  EXECUTE v_sql;

  IF p_table_name = 'purchase_orders' THEN
    UPDATE public.purchase_order_items SET deleted_at = NULL WHERE po_id = p_record_id;
  ELSIF p_table_name = 'material_receipts' THEN
    UPDATE public.material_receipt_items SET deleted_at = NULL WHERE receipt_id = p_record_id;
  ELSIF p_table_name = 'material_requests' THEN
    UPDATE public.material_request_items SET deleted_at = NULL WHERE request_id = p_record_id;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, module, performed_by, performed_at, user_role, details
  ) VALUES (
    p_table_name, p_record_id, 'restore', p_table_name, v_user_id, now(), 'md',
    jsonb_build_object('restored', true)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 3: Attendance Write Permissions (MD, Supervisor, Accounts)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_write_attendance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'md')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'accounts');
$$;

REVOKE ALL ON FUNCTION public.can_write_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_attendance() TO authenticated;

DROP POLICY IF EXISTS "attendance write" ON public.attendance;
DROP POLICY IF EXISTS "attendance insert policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance update policy" ON public.attendance;

CREATE POLICY "attendance insert policy" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_attendance());

CREATE POLICY "attendance update policy" ON public.attendance
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.can_write_attendance())
  WITH CHECK (deleted_at IS NULL AND public.can_write_attendance());

-- -------------------------------------------------------------------------
-- PART 4: Revoke DELETE Privilege & Enforce INSERT/UPDATE Only on Domain Tables
-- -------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  domain_tables text[] := ARRAY[
    'expenses', 'supplier_payments', 'contractor_payments', 'contractor_bills',
    'subcontractor_payments', 'attendance', 'weekly_wage_adjustments', 'cash_closing',
    'purchase_orders', 'purchase_order_items', 'material_receipts', 'material_receipt_items',
    'material_requests', 'material_request_items', 'project_quotations',
    'client_payments', 'payment_milestones', 'wage_payments',
    'clients', 'employees', 'contractors', 'suppliers', 'machines', 'projects',
    'work_orders', 'measurement_books', 'account_transfers'
  ];
BEGIN
  FOREACH tbl IN ARRAY domain_tables LOOP
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', tbl);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- PART 5: Deletion Requests & Approval Functions
-- -------------------------------------------------------------------------

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_requests select" ON public.deletion_requests;
CREATE POLICY "deletion_requests select" ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_md() OR requested_by = auth.uid());

DROP POLICY IF EXISTS "deletion_requests insert" ON public.deletion_requests;
CREATE POLICY "deletion_requests insert" ON public.deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "deletion_requests update" ON public.deletion_requests;
CREATE POLICY "deletion_requests update" ON public.deletion_requests
  FOR UPDATE TO authenticated
  USING (public.is_md())
  WITH CHECK (public.is_md());

DROP POLICY IF EXISTS "deletion_requests delete" ON public.deletion_requests;
CREATE POLICY "deletion_requests delete" ON public.deletion_requests
  FOR DELETE TO authenticated
  USING (public.is_md());

-- Server-side Approve Deletion Request
CREATE OR REPLACE FUNCTION public.approve_deletion_request(
  p_request_id uuid,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_md_id uuid := auth.uid();
  v_md_email text;
BEGIN
  IF NOT COALESCE(public.is_md(), false) THEN
    RAISE EXCEPTION 'Only the Managing Director can approve deletion requests.';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending deletion request not found.';
  END IF;

  -- 1. Perform safe soft delete
  PERFORM public.soft_delete_record(v_req.table_name, v_req.record_id::uuid);

  -- 2. Update request status
  SELECT email INTO v_md_email FROM auth.users WHERE id = v_md_id;
  UPDATE public.deletion_requests
  SET status = 'approved',
      reviewed_by = v_md_id,
      reviewed_by_email = v_md_email,
      reviewed_at = now(),
      review_notes = p_notes
  WHERE id = p_request_id;

  -- 3. Notify requester
  IF v_req.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id,
      target_user_id, created_by, created_by_email, details
    ) VALUES (
      'delete_approved',
      'Deletion Approved: ' || v_req.record_title,
      'Your request to delete "' || v_req.record_title || '" has been approved by the MD.',
      v_req.table_name,
      v_req.record_id,
      v_req.requested_by,
      v_md_id,
      v_md_email,
      jsonb_build_object('requestId', p_request_id, 'notes', p_notes)
    );
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_deletion_request(uuid, text) TO authenticated;

-- Server-side Reject Deletion Request
CREATE OR REPLACE FUNCTION public.reject_deletion_request(
  p_request_id uuid,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_md_id uuid := auth.uid();
  v_md_email text;
BEGIN
  IF NOT COALESCE(public.is_md(), false) THEN
    RAISE EXCEPTION 'Only the Managing Director can reject deletion requests.';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending deletion request not found.';
  END IF;

  SELECT email INTO v_md_email FROM auth.users WHERE id = v_md_id;
  UPDATE public.deletion_requests
  SET status = 'rejected',
      reviewed_by = v_md_id,
      reviewed_by_email = v_md_email,
      reviewed_at = now(),
      review_notes = COALESCE(p_notes, 'Rejected by MD')
  WHERE id = p_request_id;

  IF v_req.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id,
      target_user_id, created_by, created_by_email, details
    ) VALUES (
      'delete_rejected',
      'Deletion Rejected: ' || v_req.record_title,
      'Your request to delete "' || v_req.record_title || '" was rejected. Notes: ' || COALESCE(p_notes, 'None'),
      v_req.table_name,
      v_req.record_id,
      v_req.requested_by,
      v_md_id,
      v_md_email,
      jsonb_build_object('requestId', p_request_id, 'notes', p_notes)
    );
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_deletion_request(uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- PART 6: Notifications Hardening & Per-User Read Tracking
-- -------------------------------------------------------------------------

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_reads select own" ON public.notification_reads;
CREATE POLICY "notification_reads select own" ON public.notification_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_reads insert own" ON public.notification_reads;
CREATE POLICY "notification_reads insert own" ON public.notification_reads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_reads update own" ON public.notification_reads;
CREATE POLICY "notification_reads update own" ON public.notification_reads
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

-- Notifications RLS
DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (target_role = 'md' AND public.is_md())
    OR target_user_id = auth.uid()
    OR (created_by = auth.uid() AND target_role IS NULL AND target_user_id IS NULL)
  );

DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications update" ON public.notifications;
-- UPDATE policy is removed; read status is maintained in notification_reads.

-- -------------------------------------------------------------------------
-- PART 7: Audit Log Hardening
-- -------------------------------------------------------------------------

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_md());

DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid() OR auth.uid() IS NULL);

-- -------------------------------------------------------------------------
-- PART 8: Row Markers (Orange = Edited, Red = Pending Delete)
-- -------------------------------------------------------------------------

-- 1. Add tracking columns to operational and master tables
DO $$
DECLARE
  tbl text;
  track_tables text[] := ARRAY[
    'attendance', 'expenses', 'supplier_payments', 'contractor_payments',
    'contractor_bills', 'subcontractor_payments', 'weekly_wage_adjustments',
    'purchase_orders', 'material_receipts', 'material_requests',
    'project_quotations', 'client_payments', 'employees', 'contractors',
    'suppliers', 'clients', 'projects'
  ];
BEGIN
  FOREACH tbl IN ARRAY track_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_edited_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_edited_by uuid', tbl);
  END LOOP;
END $$;

-- 2. Universal Trigger to track edits & send notification to MD on non-MD edit
CREATE OR REPLACE FUNCTION public.trg_track_row_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_md boolean := false;
  v_has_real_changes boolean := false;
BEGIN
  -- Check if real fields changed (ignoring updated_at, last_edited_at, etc.)
  IF (to_jsonb(NEW) - 'updated_at' - 'last_edited_at' - 'last_edited_by') IS DISTINCT FROM
     (to_jsonb(OLD) - 'updated_at' - 'last_edited_at' - 'last_edited_by') THEN
    v_has_real_changes := true;
  END IF;

  IF NOT v_has_real_changes THEN
    RETURN NEW;
  END IF;

  NEW.last_edited_at = now();
  NEW.last_edited_by = v_user_id;

  SELECT public.is_md() INTO v_is_md;

  -- If modified by a non-MD user, dispatch notification to MD
  IF NOT COALESCE(v_is_md, false) THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    INSERT INTO public.notifications (
      type, title, message, table_name, record_id,
      target_role, created_by, created_by_email, details
    ) VALUES (
      'edit',
      'Edit in ' || replace(TG_TABLE_NAME, '_', ' '),
      'Record modified in ' || TG_TABLE_NAME || ' by ' || COALESCE(v_user_email, 'user'),
      TG_TABLE_NAME,
      NEW.id::text,
      'md',
      v_user_id,
      v_user_email,
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
  track_tables text[] := ARRAY[
    'attendance', 'expenses', 'supplier_payments', 'contractor_payments',
    'contractor_bills', 'subcontractor_payments', 'weekly_wage_adjustments',
    'purchase_orders', 'material_receipts', 'material_requests',
    'project_quotations', 'client_payments', 'employees', 'contractors',
    'suppliers', 'clients', 'projects'
  ];
BEGIN
  FOREACH tbl IN ARRAY track_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_track_edits_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_track_edits_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_track_row_edits()', tbl, tbl);
  END LOOP;
END $$;

-- 3. Safe Marker Function callable by authenticated users
CREATE OR REPLACE FUNCTION public.get_row_markers(
  p_table text,
  p_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  edited boolean,
  pending_delete boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sql text;
BEGIN
  -- Whitelist allowable tables
  IF p_table NOT IN (
    'attendance', 'expenses', 'supplier_payments', 'contractor_payments',
    'contractor_bills', 'subcontractor_payments', 'weekly_wage_adjustments',
    'purchase_orders', 'material_receipts', 'material_requests',
    'project_quotations', 'client_payments', 'employees', 'contractors',
    'suppliers', 'clients', 'projects', 'cash_closing'
  ) THEN
    RAISE EXCEPTION 'Table % not supported for row markers.', p_table;
  END IF;

  v_sql := format(
    'SELECT t.id,
            (t.last_edited_at IS NOT NULL) AS edited,
            EXISTS (
              SELECT 1 FROM public.deletion_requests dr
              WHERE dr.table_name = %L
                AND dr.record_id = t.id::text
                AND dr.status = ''pending''
            ) AS pending_delete
     FROM public.%I t
     WHERE t.id = ANY(%L)',
    p_table, p_table, p_ids
  );

  RETURN QUERY EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_row_markers(text, uuid[]) TO authenticated;
